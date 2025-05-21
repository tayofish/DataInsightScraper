import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './use-auth';

// WebSocket context type with enhanced offline support
interface WebSocketContextType {
  status: string;
  sendMessage: (message: any) => void;
  lastMessage: any | null;
  isDatabaseDown: boolean;
  pendingMessageCount: number;
  forceSyncNow: () => void;
  lastConnectionAttempt: Date | null;
}

// Queue item interface for offline message storage
interface QueueItem {
  type: string;
  data: any;
  timestamp: number;
  attempts: number;
}

// Create context with default values
const WebSocketContext = createContext<WebSocketContextType>({
  status: 'disconnected',
  sendMessage: () => {},
  lastMessage: null,
  isDatabaseDown: false,
  pendingMessageCount: 0,
  forceSyncNow: () => {},
  lastConnectionAttempt: null
});

// WebSocket Provider with robust offline support
export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<string>('connecting');
  const [lastMessage, setLastMessage] = useState<any | null>(null);
  const [isDatabaseDown, setIsDatabaseDown] = useState<boolean>(false);
  const [pendingMessageCount, setPendingMessageCount] = useState<number>(0);
  const [lastConnectionAttempt, setLastConnectionAttempt] = useState<Date | null>(null);
  
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const offlineQueueRef = useRef<QueueItem[]>([]);
  const clientIdRef = useRef<string>(
    localStorage.getItem('client_id') || 
    `client_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`
  );
  
  // Load offline queue from localStorage on mount
  useEffect(() => {
    try {
      // Save client ID for message tracking
      localStorage.setItem('client_id', clientIdRef.current);
      
      // Load any pending messages from localStorage
      const savedQueue = localStorage.getItem('offline_message_queue');
      if (savedQueue) {
        offlineQueueRef.current = JSON.parse(savedQueue);
        setPendingMessageCount(offlineQueueRef.current.length);
        console.log(`[WebSocket] Loaded ${offlineQueueRef.current.length} pending messages from storage`);
      }
    } catch (error) {
      console.error('[WebSocket] Error loading offline queue:', error);
    }
    
    // Check database connection status
    checkDatabaseStatus();
  }, []);
  
  // Check database connection status
  const checkDatabaseStatus = async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      
      const isDown = !data.databaseConnected;
      setIsDatabaseDown(isDown);
      
      if (isDown) {
        console.warn('[WebSocket] Database is down, operating in offline mode');
        setStatus('database_down');
      } else if (status === 'database_down') {
        console.log('[WebSocket] Database is back online');
        setStatus('reconnecting');
        setupWebSocket();
      }
    } catch (error) {
      console.error('[WebSocket] Error checking database status:', error);
      setIsDatabaseDown(true);
      setStatus('database_down');
    }
  };
  
  // Process offline message queue
  const processOfflineQueue = useCallback(() => {
    if (offlineQueueRef.current.length === 0) {
      return;
    }
    
    console.log(`[WebSocket] Processing ${offlineQueueRef.current.length} offline messages`);
    
    // Process queue in FIFO order with rate limiting
    const processNextBatch = async () => {
      const socket = socketRef.current;
      // Make a copy of the queue to work with
      const queue = [...offlineQueueRef.current];
      offlineQueueRef.current = [];
      const maxBatchSize = 5;
      const batch = queue.splice(0, maxBatchSize);
      
      if (batch.length === 0) {
        return;
      }
      
      let successCount = 0;
      
      for (const item of batch) {
        // Skip if too many attempts
        if (item.attempts > 10) {
          console.warn('[WebSocket] Dropping message after 10 failed attempts');
          continue;
        }
        
        // Update attempt counter
        item.attempts = (item.attempts || 0) + 1;
        
        try {
          if (socket && socket.readyState === WebSocket.OPEN && !isDatabaseDown) {
            // Send message through websocket if connected
            socket.send(JSON.stringify({
              ...item.data,
              clientId: clientIdRef.current,
              timestamp: item.timestamp,
            }));
            successCount++;
          } else {
            // Return to queue if can't send
            offlineQueueRef.current.push(item);
          }
        } catch (error) {
          console.error('[WebSocket] Error sending cached message:', error);
          offlineQueueRef.current.push(item);
        }
        
        // Add small delay between sends
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Add remaining items back to the queue
      offlineQueueRef.current.push(...queue);
      
      // Update queue in localStorage
      if (offlineQueueRef.current.length > 0) {
        localStorage.setItem('offline_message_queue', JSON.stringify(offlineQueueRef.current));
      } else {
        localStorage.removeItem('offline_message_queue');
      }
      
      setPendingMessageCount(offlineQueueRef.current.length);
      
      // Continue with next batch if there are more messages
      if (offlineQueueRef.current.length > 0) {
        setTimeout(processNextBatch, 1000);
      }
    };
    
    processNextBatch();
  }, [isDatabaseDown]);
  
  // Setup WebSocket connection
  const setupWebSocket = useCallback(() => {
    if (!user || !user.id) {
      console.log('[WebSocket] No user logged in, not connecting');
      return;
    }
    
    // Clear any existing reconnection timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Close existing connection if any
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    setLastConnectionAttempt(new Date());
    setStatus('connecting');
    
    try {
      // Create WebSocket connection with user info and client ID
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?userId=${user.id}&username=${encodeURIComponent(user.username || '')}&clientId=${clientIdRef.current}`;
      
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      
      socket.onopen = () => {
        console.log('[WebSocket] Connection established');
        setStatus('connected');
        
        // Process any pending messages once connected
        processOfflineQueue();
      };
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage(message);
          
          // Handle specific message types
          if (message.type === 'database_status') {
            setIsDatabaseDown(!message.connected);
            
            if (message.connected && isDatabaseDown) {
              // Database is back online, process offline queue
              processOfflineQueue();
            }
          }
        } catch (error) {
          console.error('[WebSocket] Error processing message:', error);
        }
      };
      
      socket.onclose = (event) => {
        console.log(`[WebSocket] Connection closed: ${event.code} ${event.reason}`);
        setStatus('disconnected');
        
        // Attempt to reconnect after delay
        reconnectTimeoutRef.current = setTimeout(() => {
          setupWebSocket();
        }, 5000);
      };
      
      socket.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        setStatus('error');
      };
    } catch (error) {
      console.error('[WebSocket] Setup error:', error);
      setStatus('error');
      
      // Attempt to reconnect after delay
      reconnectTimeoutRef.current = setTimeout(() => {
        setupWebSocket();
      }, 5000);
    }
  }, [user, isDatabaseDown, processOfflineQueue]);
  
  // Force manual sync of offline queue
  const forceSyncNow = useCallback(() => {
    console.log('[WebSocket] Manual sync requested');
    
    // Check database status first
    checkDatabaseStatus().then(() => {
      if (!isDatabaseDown) {
        processOfflineQueue();
      }
    });
  }, [isDatabaseDown, processOfflineQueue]);
  
  // Send a message through WebSocket with offline fallback
  const sendMessage = useCallback((message: any) => {
    // Add client ID for tracking
    const messageWithClientId = {
      ...message,
      clientId: clientIdRef.current,
      timestamp: Date.now()
    };
    
    // Try to send through WebSocket if connected
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && !isDatabaseDown) {
      try {
        socketRef.current.send(JSON.stringify(messageWithClientId));
        return;
      } catch (error) {
        console.error('[WebSocket] Error sending message:', error);
        // Fall through to offline storage
      }
    }
    
    // Store in offline queue if not sent
    console.log('[WebSocket] Storing message in offline queue:', message.type);
    
    try {
      // Add to in-memory queue
      offlineQueueRef.current.push({
        type: message.type,
        data: messageWithClientId,
        timestamp: Date.now(),
        attempts: 0
      });
      
      // Update localStorage
      localStorage.setItem('offline_message_queue', JSON.stringify(offlineQueueRef.current));
      setPendingMessageCount(offlineQueueRef.current.length);
    } catch (e) {
      console.error('[WebSocket] Error saving to offline queue:', e);
    }
  }, [isDatabaseDown]);
  
  // Set up WebSocket when user changes
  useEffect(() => {
    if (user && user.id) {
      setupWebSocket();
    }
    
    return () => {
      // Clean up on unmount
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [user, setupWebSocket]);
  
  // Periodically check database status
  useEffect(() => {
    const checkInterval = setInterval(() => {
      checkDatabaseStatus();
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(checkInterval);
  }, []);
  
  return (
    <WebSocketContext.Provider value={{ 
      status, 
      sendMessage, 
      lastMessage, 
      isDatabaseDown,
      pendingMessageCount,
      forceSyncNow,
      lastConnectionAttempt
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Custom hook to use the WebSocket context
export const useWebSocket = () => useContext(WebSocketContext);