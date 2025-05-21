import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
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
  const [isDatabaseDown, setIsDatabaseDown] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const offlineQueueRef = useRef<any[]>([]);

  // Check for database connectivity issues
  useEffect(() => {
    const checkDatabaseStatus = () => {
      const lastDatabaseError = localStorage.getItem('last_database_error');
      if (lastDatabaseError) {
        const lastErrorTime = new Date(lastDatabaseError).getTime();
        const now = new Date().getTime();
        // Consider database down if error was in the last 5 minutes
        if (now - lastErrorTime < 5 * 60 * 1000) {
          setIsDatabaseDown(true);
          return true;
        }
      }
      return false;
    };

    const isDbDown = checkDatabaseStatus();
    setIsDatabaseDown(isDbDown);
    
    const interval = setInterval(() => {
      const isDbDown = checkDatabaseStatus();
      setIsDatabaseDown(isDbDown);
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Cleanup WebSocket connection
  const cleanupSocket = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {
        console.error("Error closing socket", e);
      }
    }
  }, []);

  // Connect to WebSocket server
  const connectSocket = useCallback(() => {
    if (!user) {
      return;
    }

    try {
      cleanupSocket();
      setStatus('connecting');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;
      
      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onopen = () => {
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
        
        // Authenticate
        if (socketRef.current && user) {
          const authMessage = {
            type: 'auth',
            userId: user.id,
            username: user.username
          };
          socketRef.current.send(JSON.stringify(authMessage));
        }
        
        // Process any queued messages
        processOfflineQueue();
      };

      socketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          
          // Handle different message types to update React Query cache
          if (data.type === 'new_direct_message' || data.type === 'direct_message_updated') {
            queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/${data.otherUserId}`] });
            queryClient.invalidateQueries({ queryKey: [`/api/direct-messages/conversations`] });
          } else if (data.type === 'new_channel_message' || data.type === 'channel_message_updated') {
            queryClient.invalidateQueries({ queryKey: [`/api/channels/${data.channelId}/messages`] });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      socketRef.current.onerror = () => {
        setStatus('error');
      };

      socketRef.current.onclose = () => {
        setStatus('disconnected');
        
        // Try to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          
          reconnectTimerRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connectSocket();
          }, delay);
        }
      };
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
      setStatus('error');
    }
  }, [user, cleanupSocket]);

  // Process messages in the offline queue
  const processOfflineQueue = useCallback(() => {
    if (offlineQueueRef.current.length === 0 || !socketRef.current || isDatabaseDown) {
      return;
    }
    
    const queue = [...offlineQueueRef.current];
    offlineQueueRef.current = [];
    
    queue.forEach(item => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        try {
          socketRef.current.send(JSON.stringify(item.data));
        } catch (e) {
          console.error('Error sending queued message:', e);
          offlineQueueRef.current.push(item);
        }
      } else {
        offlineQueueRef.current.push(item);
      }
    });
    
    // Update storage if there are still items in the queue
    if (offlineQueueRef.current.length > 0) {
      localStorage.setItem('offline_message_queue', JSON.stringify(offlineQueueRef.current));
    } else {
      localStorage.removeItem('offline_message_queue');
    }
  }, [isDatabaseDown]);

  // Initialize WebSocket connection when component mounts
  useEffect(() => {
    if (user && status === 'disconnected' && !isDatabaseDown) {
      connectSocket();
    }
    
    return cleanupSocket;
  }, [user, connectSocket, cleanupSocket, status, isDatabaseDown]);

  // Load offline queue from localStorage
  useEffect(() => {
    try {
      const queueData = localStorage.getItem('offline_message_queue');
      if (queueData) {
        offlineQueueRef.current = JSON.parse(queueData);
      }
    } catch (e) {
      console.error('Error loading offline queue:', e);
    }
    
    // Listen for manual sync attempts
    const handleManualSync = () => {
      if (status !== 'connected') {
        connectSocket();
      } else {
        processOfflineQueue();
      }
    };
    
    window.addEventListener('manual-sync-attempt', handleManualSync);
    
    return () => {
      window.removeEventListener('manual-sync-attempt', handleManualSync);
    };
  }, [status, connectSocket, processOfflineQueue]);

  // Send a message through the WebSocket
  const sendMessage = useCallback((message: any) => {
    // Mark message as optimistic for UI
    if (message.type === 'channel_message' || message.type === 'direct_message') {
      message.isOptimistic = true;
      message.timestamp = new Date().toISOString();
    }
    
    // Save to offline queue if offline or database is down
    if (status !== 'connected' || isDatabaseDown) {
      const queueItem = {
        type: message.type,
        data: message,
        timestamp: Date.now()
      };
      
      offlineQueueRef.current.push(queueItem);
      
      try {
        localStorage.setItem('offline_message_queue', JSON.stringify(offlineQueueRef.current));
      } catch (e) {
        console.error('Error saving to offline queue:', e);
      }
      
      return;
    }
    
    // Send through WebSocket if connected
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify(message));
      } catch (e) {
        console.error('Error sending message:', e);
        // Fall back to offline queue on error
        offlineQueueRef.current.push({
          type: message.type,
          data: message,
          timestamp: Date.now()
        });
        localStorage.setItem('offline_message_queue', JSON.stringify(offlineQueueRef.current));
      }
    } else {
      // Add to offline queue if not connected
      offlineQueueRef.current.push({
        type: message.type,
        data: message,
        timestamp: Date.now()
      });
      localStorage.setItem('offline_message_queue', JSON.stringify(offlineQueueRef.current));
    }
  }, [status, isDatabaseDown]);

  return (
    <WebSocketContext.Provider value={{ status, sendMessage, lastMessage, isDatabaseDown }}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Custom hook to use the WebSocket context
export const useWebSocket = () => useContext(WebSocketContext);