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
  isDatabaseDown: boolean;
}

// Create context with default values
const WebSocketContext = createContext<WebSocketContextType>({
  status: 'disconnected',
  sendMessage: () => {},
  lastMessage: null,
  isDatabaseDown: false
});

// Maximum reconnection attempts
const MAX_RECONNECT_ATTEMPTS = 10;

// WebSocket Provider component
export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<any>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const offlineQueueRef = useRef<Array<{
    type: string, 
    data: any, 
    timestamp: number, 
    attempts?: number, 
    lastAttempt?: number
  }>>([]);
  
  // Database connection status
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
          console.log('[WebSocket] Message received:', data);
          
          // Check for database connection errors and handle them gracefully
          if (data.type === 'error' && data.errorType === 'database_error') {
            console.warn('[WebSocket] Database error:', data.message);
            // Mark database as down if we receive a database error
            localStorage.setItem('last_database_error', new Date().toISOString());
            setIsDatabaseDown(true);
            return;
          }
          
          setLastMessage(data);

          // Handle different message types
          if (data.type === 'auth_success') {
            console.log('[WebSocket] Authentication successful');
          } else if (data.type === 'welcome') {
            console.log('[WebSocket] Received welcome message');
          } else if ((data.type === 'new_direct_message' || data.type === 'direct_message_sent') && data.message) {
            // Handle direct messages
            queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/${data.otherUserId}`] });
            queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/conversations`] });
          } else if (data.type === 'new_channel_message' && data.message) {
            // Handle channel messages  
            queryClient.invalidateQueries({ queryKey: [`/api/channels/${data.channelId}/messages`] });
          } else if (data.type === 'message_updated' && data.message) {
            // Handle updated messages
            const channelId = data.channelId || data.message.channelId;
            queryClient.invalidateQueries({ queryKey: [`/api/channels/${channelId}/messages`] });
          } else if (data.type === 'error') {
            console.error('[WebSocket] Error from server:', data.message);
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
        console.log(`[WebSocket] Connection closed: Code ${event.code}`);
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

  // Process offline message queue
  const processQueue = useCallback(async (forceProcess = false) => {
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
    
    // Clear the queue first
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
  }, [isDatabaseDown]);
  
  // Load offline queue from localStorage
  useEffect(() => {
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
  }, []);

  // Listen for manual sync attempts
  useEffect(() => {
    const handleManualSync = () => {
      console.log('[WebSocket] Manual sync attempt triggered');
      
      // First try to reconnect if disconnected
      if (status !== 'connected' || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        console.log('[WebSocket] Attempting reconnection as part of manual sync');
        cleanupSocket();
        setupSocket();
      }
      
      // Then force process the queue
      setTimeout(() => {
        console.log('[WebSocket] Forcing queue processing as part of manual sync');
        processQueue(true); // Pass true to force processing
      }, 1000); // Small delay to allow socket to reconnect
    };
    
    window.addEventListener('manual-sync-attempt', handleManualSync);
    
    return () => {
      window.removeEventListener('manual-sync-attempt', handleManualSync);
    };
  }, [status, setupSocket, cleanupSocket, processQueue]);

  // Handle changes to websocket status
  useEffect(() => {
    if (status === 'connected' && !isDatabaseDown && offlineQueueRef.current.length > 0) {
      console.log('[WebSocket] Connection restored. Processing offline queue...');
      processQueue();
    }
  }, [status, isDatabaseDown, processQueue]);

  // Initialize WebSocket connection
  useEffect(() => {
    // Only connect if we have a user and we're not already connected
    if (user && status === 'disconnected') {
      setupSocket();
    }
    
    return () => {
      cleanupSocket();
    };
  }, [user, setupSocket, cleanupSocket, status]);

  // Send message with fallback to offline queue
  const sendMessage = useCallback((message: any) => {
    // Mark message as optimistic for local display in the UI
    if (message.type === 'channel_message' || message.type === 'direct_message') {
      message.isOptimistic = true;
      message.timestamp = new Date().toISOString();
    }
    
    // If we're in offline mode or database is down, save to offline queue
    if (status !== 'connected' || isDatabaseDown) {
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
      
      return;
    }
    
    // Send through WebSocket if connected
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Sending message:', message.type);
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Not connected, adding to offline queue');
      // Fallback to offline queue
      const queueItem = {
        type: message.type,
        data: message,
        timestamp: Date.now(),
        attempts: 0
      };
      
      offlineQueueRef.current.push(queueItem);
      localStorage.setItem('offline_message_queue', JSON.stringify(offlineQueueRef.current));
    }
  }, [status, isDatabaseDown]);

  // Return the provider
  return (
    <WebSocketContext.Provider value={{ status, sendMessage, lastMessage, isDatabaseDown }}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Custom hook to use the WebSocket context
export const useWebSocket = () => useContext(WebSocketContext);