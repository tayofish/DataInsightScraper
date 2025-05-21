import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './use-auth';

interface WebSocketContextType {
  status: string;
  sendMessage: (message: any) => void;
  lastMessage: any;
  isDatabaseDown: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  status: 'disconnected',
  sendMessage: () => {},
  lastMessage: null,
  isDatabaseDown: false
});

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState('disconnected');
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [isDatabaseDown, setIsDatabaseDown] = useState(false);
  
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const offlineQueueRef = useRef<any[]>([]);
  
  // Load stored offline queue on mount
  useEffect(() => {
    try {
      const storedQueue = localStorage.getItem('offline_message_queue');
      if (storedQueue) {
        offlineQueueRef.current = JSON.parse(storedQueue);
      }
    } catch (error) {
      console.error('Error loading offline queue:', error);
    }
    
    // Check for database connection status periodically
    const checkDatabaseStatus = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        setIsDatabaseDown(!data.databaseConnected);
      } catch (error) {
        console.error('Error checking database status:', error);
        setIsDatabaseDown(true);
      }
    };
    
    checkDatabaseStatus();
    const interval = setInterval(checkDatabaseStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Setup WebSocket connection
  const setupWebSocket = useCallback(() => {
    if (!user) return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      
      socket.onopen = () => {
        console.log('WebSocket connected');
        setStatus('connected');
        
        // Send user info once connected
        if (user) {
          socket.send(JSON.stringify({
            type: 'auth',
            userId: user.id,
            username: user.username
          }));
        }
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          
          // Handle specific message types
          if (data.type === 'database_status') {
            setIsDatabaseDown(!data.connected);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      socket.onclose = () => {
        console.log('WebSocket disconnected');
        setStatus('disconnected');
        
        // Try to reconnect after a delay
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          setupWebSocket();
        }, 5000);
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatus('error');
      };
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
      setStatus('error');
    }
  }, [user]);
  
  // Attempt to process offline queue when connection is restored
  const processOfflineQueue = useCallback(() => {
    if (offlineQueueRef.current.length === 0 || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    console.log(`Processing ${offlineQueueRef.current.length} offline messages`);
    
    const tempQueue = [...offlineQueueRef.current];
    offlineQueueRef.current = [];
    
    let success = 0;
    let failed = 0;
    
    for (const message of tempQueue) {
      try {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify(message));
          success++;
        } else {
          offlineQueueRef.current.push(message);
          failed++;
        }
      } catch (error) {
        console.error('Error sending offline message:', error);
        offlineQueueRef.current.push(message);
        failed++;
      }
    }
    
    console.log(`Offline queue processing: ${success} sent, ${failed} requeued`);
    
    // Update localStorage
    if (offlineQueueRef.current.length > 0) {
      localStorage.setItem('offline_message_queue', JSON.stringify(offlineQueueRef.current));
    } else {
      localStorage.removeItem('offline_message_queue');
    }
  }, []);
  
  // Process queue when connection status changes
  useEffect(() => {
    if (status === 'connected' && !isDatabaseDown) {
      processOfflineQueue();
    }
  }, [status, isDatabaseDown, processOfflineQueue]);
  
  // Setup WebSocket when user changes
  useEffect(() => {
    if (user) {
      setupWebSocket();
    }
    
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [user, setupWebSocket]);
  
  // Handle manual sync requests
  useEffect(() => {
    const handleManualSync = () => {
      console.log('Manual sync requested');
      processOfflineQueue();
    };
    
    window.addEventListener('manual-sync-attempt', handleManualSync);
    
    return () => {
      window.removeEventListener('manual-sync-attempt', handleManualSync);
    };
  }, [processOfflineQueue]);
  
  // Send a message with offline fallback
  const sendMessage = useCallback((message: any) => {
    // Try to send immediately if connected
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && !isDatabaseDown) {
      try {
        socketRef.current.send(JSON.stringify(message));
        return;
      } catch (error) {
        console.error('Error sending message:', error);
        // Fall through to offline queue
      }
    }
    
    // Store in offline queue if sending failed
    console.log('Storing message in offline queue:', message);
    offlineQueueRef.current.push(message);
    localStorage.setItem('offline_message_queue', JSON.stringify(offlineQueueRef.current));
  }, [isDatabaseDown]);
  
  return (
    <WebSocketContext.Provider value={{ status, sendMessage, lastMessage, isDatabaseDown }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);