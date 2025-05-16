import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './use-auth';
import { queryClient } from '@/lib/queryClient';

// WebSocket connection status
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

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
          console.log('[WebSocket] Message received:', data);
          
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
            console.log('[WebSocket] Received channel message');
            
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
          } else if (data.type === 'message_updated' && data.message) {
            console.log('[WebSocket] Received updated channel message');
            
            // Update channel messages in the cache
            if (data.channelId && data.message) {
              console.log('[WebSocket] Updating edited message for channel:', data.channelId, data.message.id);
              
              // Update the message in the cache
              queryClient.setQueryData(
                [`/api/channels/${data.channelId}/messages`], 
                (oldData: any[] = []) => {
                  if (!oldData || !Array.isArray(oldData)) return [data.message];
                  
                  // Replace the edited message with the updated version
                  return oldData.map(msg => 
                    msg.id === data.message.id ? data.message : msg
                  );
                }
              );
              
              // Invalidate queries to ensure consistency
              queryClient.invalidateQueries({ queryKey: [`/api/channels/${data.channelId}/messages`] });
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

  // Send a message through WebSocket with fallback to API
  const sendMessage = useCallback((message: any) => {
    // Try to send over WebSocket first
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