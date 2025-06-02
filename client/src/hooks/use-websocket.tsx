import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './use-auth';
import { queryClient } from '@/lib/queryClient';

// WebSocket connection status
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'offline';

// WebSocket context type
interface WebSocketContextType {
  status: ConnectionStatus;
  sendMessage: (message: any) => void;
  lastMessage: any;
}

// Create context with default values
const WebSocketContext = createContext<WebSocketContextType>({
  status: 'disconnected',
  sendMessage: () => {},
  lastMessage: null,
});

// Maximum reconnection attempts
const MAX_RECONNECT_ATTEMPTS = 10;

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<any>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const offlineQueueRef = useRef<Array<{type: string, data: any, timestamp: number, attempts?: number, lastAttempt?: number}>>([]);
  
  // Check if we have a database connection issue
  const [isDatabaseDown, setIsDatabaseDown] = useState(false);
  
  // Check for database connectivity issues
  useEffect(() => {
    const checkDatabaseStatus = () => {
      const lastDatabaseError = localStorage.getItem('last_database_error');
      const lastErrorTime = lastDatabaseError ? new Date(lastDatabaseError) : null;
      const now = new Date();
      
      // Database is considered down if there was an error in the last 5 minutes
      if (lastErrorTime && (now.getTime() - lastErrorTime.getTime() < 5 * 60 * 1000)) {
        setIsDatabaseDown(true);
        setStatus('offline');
      } else {
        setIsDatabaseDown(false);
      }
    };
    
    // Check immediately and then every 30 seconds
    checkDatabaseStatus();
    const interval = setInterval(checkDatabaseStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Cleanup function to handle socket closing
  const cleanupSocket = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (socketRef.current && (
      socketRef.current.readyState === WebSocket.OPEN || 
      socketRef.current.readyState === WebSocket.CONNECTING
    )) {
      socketRef.current.close();
    }
  }, []);

  // Setup WebSocket connection
  const setupSocket = useCallback(() => {
    if (!user) {
      setStatus('disconnected');
      return;
    }

    try {
      cleanupSocket();
      setStatus('connecting');

      // Create WebSocket connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      console.log('[WebSocket] Connecting to:', wsUrl);
      
      socketRef.current = new WebSocket(wsUrl);

      // Connection established
      socketRef.current.onopen = () => {
        console.log('[WebSocket] Connection established');
        setStatus('connected');
        reconnectAttemptsRef.current = 0; // Reset reconnect counter

        // Authenticate user
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && user) {
          try {
            const authData = {
              type: 'auth',
              userId: user.id,
              username: user.username,
            };
            socketRef.current.send(JSON.stringify(authData));
          } catch (err) {
            console.error('[WebSocket] Authentication error:', err);
          }
        }
      };

      // Message received
      socketRef.current.onmessage = (event) => {
        try {
          // Validate message format
          if (typeof event.data !== 'string' || !event.data.trim()) {
            console.warn('[WebSocket] Received empty or invalid message');
            return;
          }

          const data = JSON.parse(event.data);
          console.log('[WebSocket] Message received:', data.type, data);
          
          // Debug: Log the exact type we're checking
          if (data.type && data.type.includes('channel')) {
            console.log('[WebSocket] Channel-related message detected:', data.type);
          }
          
          // Check for database connection errors and handle them gracefully
          if (data.type === 'error' && data.errorType === 'database_rate_limit') {
            console.warn('[WebSocket] Database rate limit error:', data.message);
            // We don't update the UI with rate limit errors to avoid frustrating the user
            return;
          }
          
          setLastMessage(data);

          // Handle different message types
          if (data.type === 'auth_success') {
            console.log('[WebSocket] Authentication successful');
          } else if (data.type === 'welcome') {
            console.log('[WebSocket] Received welcome message');
          } else if ((data.type === 'new_direct_message' || data.type === 'direct_message_sent') && data.message) {
            console.log('[WebSocket] Received direct message:', data.type);
            
            // Update direct messages queries
            if (data.message.senderId && data.message.receiverId) {
              const otherUserId = data.message.senderId === user.id 
                ? data.message.receiverId 
                : data.message.senderId;
                
              console.log('[WebSocket] Updating messages for conversation with:', otherUserId);
              
              // Both invalidate the queries and directly update the cache for immediate UI updates
              queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/${otherUserId}`] });
              queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/conversations`] });
              
              // Update the direct message conversation immediately
              queryClient.setQueryData(
                [`/api/direct-messages/${otherUserId}`],
                (oldData: any[] = []) => {
                  // Check if message already exists in the cache
                  const exists = oldData.some(msg => msg.id === data.message.id);
                  if (!exists) {
                    return [...oldData, data.message];
                  }
                  return oldData;
                }
              );
            }
          } else if (data.type === 'new_channel_message' && data.message) {
            console.log('[WebSocket] *** PROCESSING CHANNEL MESSAGE ***');
            console.log('[WebSocket] Received new channel message:', data.message);
            console.log('[WebSocket] Current user ID:', user?.id);
            console.log('[WebSocket] Message user ID:', data.message.userId);
            
            // Update channel messages queries
            if (data.message.channelId) {
              console.log('[WebSocket] Updating messages for channel:', data.message.channelId);
              
              // First update the cache directly for immediate UI updates
              queryClient.setQueryData(
                [`/api/channels/${data.message.channelId}/messages`], 
                (oldData: any[] = []) => {
                  if (!oldData || !Array.isArray(oldData)) return [data.message];
                  
                  // Remove any optimistic messages that match this message
                  const filteredData = oldData.filter(msg => 
                    !(msg.isOptimistic && 
                      msg.content === data.message.content && 
                      msg.userId === data.message.userId)
                  );
                  
                  // Add the new message if it doesn't already exist
                  const exists = filteredData.some(msg => msg.id === data.message.id);
                  return exists ? filteredData : [...filteredData, data.message];
                }
              );
              
              // Then invalidate the queries to ensure consistency
              queryClient.invalidateQueries({ queryKey: [`/api/channels/${data.message.channelId}/messages`] });
              queryClient.invalidateQueries({ queryKey: [`/api/channels`] });
            }
          } else if ((data.type === 'message_updated' || data.type === 'channel_message_updated') && data.message) {
            console.log('[WebSocket] Received updated channel message:', data);
            
            // Update channel messages in the cache
            const channelId = data.channelId || data.message.channelId;
            if (channelId && data.message) {
              console.log('[WebSocket] Updating edited message for channel:', channelId, data.message.id);
              
              // Ensure the message is marked as edited
              const updatedMessage = {
                ...data.message,
                isEdited: true,
                updatedAt: data.message.updatedAt || new Date().toISOString()
              };
              
              console.log('[WebSocket] Message marked as edited:', updatedMessage);
              
              // Update the message in the cache
              queryClient.setQueryData(
                [`/api/channels/${channelId}/messages`], 
                (oldData: any[] = []) => {
                  if (!oldData || !Array.isArray(oldData)) return [updatedMessage];
                  
                  // Replace the edited message with the updated version
                  return oldData.map(msg => 
                    msg.id === updatedMessage.id ? updatedMessage : msg
                  );
                }
              );
              
              // Invalidate queries to ensure consistency
              queryClient.invalidateQueries({ queryKey: [`/api/channels/${channelId}/messages`] });
            }
          } else if (data.type === 'direct_message_updated' && data.message) {
            console.log('[WebSocket] Received updated direct message');
            
            // Update direct messages in the cache
            if (data.message.senderId && data.message.receiverId) {
              const otherUserId = data.message.senderId === user.id 
                ? data.message.receiverId 
                : data.message.senderId;
                
              console.log('[WebSocket] Updating edited direct message for conversation with:', otherUserId);
              
              // Update the message in the cache
              queryClient.setQueryData(
                [`/api/direct-messages/${otherUserId}`],
                (oldData: any[] = []) => {
                  if (!oldData || !Array.isArray(oldData)) return [data.message];
                  
                  // Replace the edited message with the updated version
                  return oldData.map(msg => 
                    msg.id === data.message.id ? data.message : msg
                  );
                }
              );
              
              // Invalidate queries to ensure consistency
              queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/${otherUserId}`] });
              queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/conversations`] });
            }
          } else if (data.type === 'channel_updated') {
            console.log('[WebSocket] Channel updated:', data.channel);
            
            // Update the channels list
            queryClient.setQueryData(
              [`/api/channels`],
              (oldData: any[] = []) => {
                if (!oldData || !Array.isArray(oldData)) return [data.channel];
                
                // Replace the updated channel in the list
                return oldData.map(channel => 
                  channel.id === data.channel.id ? data.channel : channel
                );
              }
            );
            
            // Invalidate channel-related queries
            queryClient.invalidateQueries({ queryKey: [`/api/channels`] });
            queryClient.invalidateQueries({ queryKey: [`/api/channels/${data.channel.id}`] });
          } else if (data.type === 'channel_member_added' || data.type === 'channel_member_removed') {
            console.log('[WebSocket] Channel membership changed:', data.type, data.channelId);
            
            // Invalidate channel members query
            if (data.channelId) {
              queryClient.invalidateQueries({ queryKey: [`/api/channels/${data.channelId}/members`] });
              queryClient.invalidateQueries({ queryKey: [`/api/channels/${data.channelId}`] });
              queryClient.invalidateQueries({ queryKey: [`/api/channels`] });
            }
          } else if (data.type === 'error') {
            console.error('[WebSocket] Error from server:', data.message);
          } else if (data.type === 'typing_indicator') {
            // Handle typing indicators
            console.log('[WebSocket] Typing indicator received:', data);
          } else if (data.type === 'ping') {
            // Respond to server ping with pong to keep connection alive
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
              socketRef.current.send(JSON.stringify({ type: 'pong' }));
            }
          } else {
            console.log('[WebSocket] Unhandled message type:', data.type);
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      // Connection error
      socketRef.current.onerror = (error) => {
        console.error('[WebSocket] Connection error:', error);
        setStatus('error');
      };

      // Connection closed
      socketRef.current.onclose = (event) => {
        console.log(`[WebSocket] Connection closed: Code ${event.code}${event.reason ? `, Reason: ${event.reason}` : ''}`);
        setStatus('disconnected');

        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`[WebSocket] Attempting to reconnect in ${delay/1000} seconds...`);
          
          reconnectTimerRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            setupSocket();
          }, delay);
        } else {
          console.error('[WebSocket] Maximum reconnection attempts reached');
        }
      };
    } catch (error) {
      console.error('[WebSocket] Setup error:', error);
      setStatus('error');
    }
  }, [user, cleanupSocket]);

  // Handle offline message queue - loading cached messages and processing offline queue
  useEffect(() => {
    // Load offline queue from localStorage
    try {
      const offlineMessages = localStorage.getItem('offline_message_queue');
      if (offlineMessages) {
        const parsedMessages = JSON.parse(offlineMessages);
        offlineQueueRef.current = parsedMessages;
        console.log(`[WebSocket] Loaded ${parsedMessages.length} cached messages from offline storage`);
      }
    } catch (error) {
      console.error('[WebSocket] Error loading offline message queue:', error);
    }
    
    // Listen for manual sync attempts from the offline indicator
    const handleManualSync = () => {
      console.log('[WebSocket] Manual sync attempt triggered');
      
      // First try to reconnect if disconnected
      if (status !== 'connected' || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        console.log('[WebSocket] Attempting reconnection as part of manual sync');
        cleanupSocket();
        setupSocket();
      }
      
      // Then force process the queue even if we think the database is down
      setTimeout(() => {
        console.log('[WebSocket] Forcing queue processing as part of manual sync');
        if (typeof processQueue === 'function') {
          processQueue(true); // Pass true to force processing
        }
      }, 1000); // Small delay to allow socket to reconnect
    };
    
    window.addEventListener('manual-sync-attempt', handleManualSync);
    
    return () => {
      window.removeEventListener('manual-sync-attempt', handleManualSync);
    };
  }, [status, setupSocket, cleanupSocket]);
  
  // Process offline queue when connection is restored
  useEffect(() => {
    if (status === 'connected' && !isDatabaseDown && offlineQueueRef.current.length > 0) {
      console.log(`[WebSocket] Connection restored. Processing ${offlineQueueRef.current.length} offline messages`);
      
      // Process queue with a slight delay between messages to prevent rate limiting
      // forceProcess = true can be used to force processing even if DB is down
      const processQueue = async (forceProcess = false) => {
        // Don't process if database is down, unless forced
        if (isDatabaseDown && !forceProcess) {
          console.log('[WebSocket] Database is down, skipping queue processing');
          return;
        }
        
        const queue = [...offlineQueueRef.current];
        if (queue.length === 0) {
          console.log('[WebSocket] No messages in offline queue to process');
          return;
        }
        
        console.log(`[WebSocket] Processing ${queue.length} offline messages${forceProcess ? ' (forced)' : ''}`);
        
        // Clear the queue but keep a backup to restore failed items
        offlineQueueRef.current = [];
        localStorage.removeItem('offline_message_queue');
        
        try {
          let successCount = 0;
          let failedItems = [];
          
          for (const item of queue) {
            console.log(`[WebSocket] Processing offline message: ${item.type} from ${new Date(item.timestamp).toLocaleString()}`);
            await new Promise(resolve => setTimeout(resolve, 300)); // Small delay between messages
            
            // Try to send the message now that we're online
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
              try {
                socketRef.current.send(JSON.stringify(item.data));
                console.log('[WebSocket] Successfully sent cached message');
                successCount++;
              } catch (e) {
                console.warn('[WebSocket] Error sending cached message:', e);
                // Track retry attempts
                const updatedItem = { 
                  ...item, 
                  attempts: (item.attempts || 0) + 1,
                  lastAttempt: Date.now()
                };
                
                // Only retry messages that haven't failed too many times
                if (updatedItem.attempts < 5) {
                  failedItems.push(updatedItem);
                } else {
                  console.warn(`[WebSocket] Message dropped after ${updatedItem.attempts} failed attempts`);
                }
              }
            } else {
              console.warn('[WebSocket] Failed to send cached message, socket not open');
              failedItems.push({ 
                ...item, 
                attempts: (item.attempts || 0) + 1,
                lastAttempt: Date.now()
              });
            }
          }
          
          // Restore failed items to the queue
          offlineQueueRef.current = failedItems;
          
          // If any messages failed to send, update localStorage
          if (offlineQueueRef.current.length > 0) {
            localStorage.setItem('offline_message_queue', JSON.stringify(offlineQueueRef.current));
            console.log(`[WebSocket] ${successCount} messages sent, ${offlineQueueRef.current.length} messages still pending`);
          } else if (successCount > 0) {
            console.log(`[WebSocket] All ${successCount} offline messages processed successfully`);
          }
        } catch (error) {
          console.error('[WebSocket] Error processing offline message queue:', error);
        }
      };
      
      processQueue();
    }
  }, [status, isDatabaseDown, processQueue]);

  // Send a message through WebSocket with fallback to API and offline storage
  const sendMessage = useCallback((message: any) => {
    // Mark message as optimistic for local display in the UI
    if (message.type === 'channel_message' || message.type === 'direct_message') {
      message.isOptimistic = true;
      message.timestamp = new Date().toISOString();
    }
    
    // If we're in offline mode or database is down, save to offline queue
    if (status === 'offline' || isDatabaseDown) {
      console.log('[WebSocket] In offline mode, storing message for later sync:', message.type);
      
      // Store in offline queue
      const queueItem = {
        type: message.type,
        data: message,
        timestamp: Date.now(),
        attempts: 0
      };
      
      offlineQueueRef.current.push(queueItem);
      
      // Persist to localStorage for resilience against page reloads
      try {
        localStorage.setItem('offline_message_queue', JSON.stringify(offlineQueueRef.current));
        console.log(`[WebSocket] Saved message to offline queue (${offlineQueueRef.current.length} pending)`);
      } catch (error) {
        console.error('[WebSocket] Error saving to offline queue:', error);
      }
      
      // Immediately update UI with optimistic update if it's a message
      if (message.type === 'channel_message' && message.channelId) {
        // Create optimistic message for immediate UI feedback
        const optimisticMessage = {
          id: `temp_${Date.now()}`,
          channelId: message.channelId,
          content: message.content,
          userId: message.userId || (user ? user.id : 0),
          username: user ? user.username : 'Unknown',
          createdAt: new Date().toISOString(),
          isOptimistic: true,
          isPending: true
        };
        
        // Update UI immediately with optimistic message
        queryClient.setQueryData(
          [`/api/channels/${message.channelId}/messages`],
          (oldData: any[] = []) => [...oldData, optimisticMessage]
        );
      }
      
      return true; // Message stored for later sync
    }
    
    // Try to send over WebSocket if connected
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        console.log('[WebSocket] Sending message via WebSocket:', message.type);
        socketRef.current.send(JSON.stringify(message));
        return true; // Message sent successfully via WebSocket
      } catch (error) {
        console.error('[WebSocket] Error sending message:', error);
        // Will fall through to API fallback below
      }
    } else {
      console.warn('[WebSocket] Socket not connected, using API fallback');
      
      // Try to reconnect if socket is closed unexpectedly (async)
      if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
        setupSocket();
      }
    }

    // Fallback to REST API if WebSocket fails
    try {
      console.log('[WebSocket] Using API fallback for message type:', message.type);
      
      if (message.type === 'channel_message') {
        // Channel message fallback
        fetch(`/api/channels/${message.channelId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            content: message.content,
            parentId: message.parentId || null,
            mentions: message.mentions || null
          })
        })
        .then(response => {
          if (response.ok) {
            console.log('[WebSocket] Channel message sent using API fallback');
            // Force refresh query data
            queryClient.invalidateQueries({ queryKey: [`/api/channels/${message.channelId}/messages`] });
            return true;
          } else {
            console.error('[WebSocket] API fallback failed for channel message');
            return false;
          }
        })
        .catch(error => {
          console.error('[WebSocket] Channel message API error:', error);
          return false;
        });
      }
      else if (message.type === 'edit_channel_message') {
        // Edit channel message fallback
        fetch(`/api/channels/${message.channelId}/messages/${message.messageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            content: message.content
          })
        })
        .then(response => {
          if (response.ok) {
            console.log('[WebSocket] Channel message edit sent using API fallback');
            // Force refresh query data
            queryClient.invalidateQueries({ queryKey: [`/api/channels/${message.channelId}/messages`] });
            return true;
          } else {
            console.error('[WebSocket] API fallback failed for channel message edit');
            return false;
          }
        })
        .catch(error => {
          console.error('[WebSocket] Channel message edit API error:', error);
          return false;
        });
      } 
      else if (message.type === 'direct_message') {
        // Direct message fallback
        fetch(`/api/direct-messages/${message.receiverId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            content: message.content,
            mentions: message.mentions || null
          })
        })
        .then(response => {
          if (response.ok) {
            console.log('[WebSocket] Direct message sent using API fallback');
            // Force refresh query data
            queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/${message.receiverId}`] });
            queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/conversations`] });
            return true;
          } else {
            console.error('[WebSocket] API fallback failed for direct message');
            return false;
          }
        })
        .catch(error => {
          console.error('[WebSocket] Direct message API error:', error);
          return false;
        });
      }
    } catch (apiError) {
      console.error('[WebSocket] API fallback error:', apiError);
    }
    
    return false; // Message sending failed
  }, [setupSocket]);

  // Initialize WebSocket when user logs in
  useEffect(() => {
    if (user) {
      setupSocket();
    } else {
      cleanupSocket();
      setStatus('disconnected');
    }

    // Cleanup on unmount
    return () => {
      cleanupSocket();
    };
  }, [user, setupSocket, cleanupSocket]);

  // Handle page visibility changes to reconnect when user returns to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
          console.log('[WebSocket] Reconnecting after page became visible');
          setupSocket();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, setupSocket]);

  // Context value
  const contextValue: WebSocketContextType = {
    status,
    sendMessage,
    lastMessage,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Hook for consuming WebSocket context
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  
  return context;
};