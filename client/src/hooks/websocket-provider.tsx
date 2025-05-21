import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './use-auth';

interface WebSocketContextType {
  status: string;
  sendMessage: (message: any) => void;
  lastMessage: any;
  isDatabaseDown: boolean;
  pendingMessageCount: number;
  lastConnectionAttempt: Date | null;
  forceSyncNow: () => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  status: 'disconnected',
  sendMessage: () => {},
  lastMessage: null,
  isDatabaseDown: false,
  pendingMessageCount: 0,
  lastConnectionAttempt: null,
  forceSyncNow: () => {}
});

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState('disconnected');
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [isDatabaseDown, setIsDatabaseDown] = useState(false);
  const [pendingMessageCount, setPendingMessageCount] = useState(0);
  const [lastConnectionAttempt, setLastConnectionAttempt] = useState<Date | null>(null);
  
  const socketRef = useRef<WebSocket | null>(null);
  const offlineQueueRef = useRef<any[]>([]);
  
  // Check database status periodically
  useEffect(() => {
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
    
    // Check immediately on mount
    checkDatabaseStatus();
    
    // Then check every 30 seconds
    const interval = setInterval(checkDatabaseStatus, 30000);
    return () => clearInterval(interval);
  }, []);
  
  // Load saved offline messages on mount
  useEffect(() => {
    try {
      const storedQueue = localStorage.getItem('offline_message_queue');
      if (storedQueue) {
        const parsed = JSON.parse(storedQueue);
        offlineQueueRef.current = parsed;
        setPendingMessageCount(parsed.length);
      }
    } catch (error) {
      console.error('Error loading stored offline messages:', error);
    }
  }, []);
  
  // Process offline queue
  const processOfflineQueue = useCallback(() => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || offlineQueueRef.current.length === 0) {
      return;
    }
    
    console.log(`Processing ${offlineQueueRef.current.length} queued messages`);
    
    const tempQueue = [...offlineQueueRef.current];
    offlineQueueRef.current = [];
    setPendingMessageCount(0);
    
    let success = 0;
    let failed = 0;
    
    tempQueue.forEach(message => {
      try {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && !isDatabaseDown) {
          socketRef.current.send(JSON.stringify(message));
          success++;
        } else {
          offlineQueueRef.current.push(message);
          failed++;
        }
      } catch (error) {
        console.error('Failed to send queued message:', error);
        offlineQueueRef.current.push(message);
        failed++;
      }
    });
    
    if (failed > 0) {
      setPendingMessageCount(failed);
      localStorage.setItem('offline_message_queue', JSON.stringify(offlineQueueRef.current));
    } else {
      localStorage.removeItem('offline_message_queue');
    }
    
    console.log(`Queue processing complete: ${success} sent, ${failed} requeued`);
  }, [isDatabaseDown]);
  
  // Attempt to process queue when connection is restored
  useEffect(() => {
    if (status === 'connected' && !isDatabaseDown) {
      processOfflineQueue();
    }
  }, [status, isDatabaseDown, processOfflineQueue]);
  
  // Handle manual sync requests
  const forceSyncNow = useCallback(() => {
    setLastConnectionAttempt(new Date());
    console.log('Manual sync requested');
    processOfflineQueue();
  }, [processOfflineQueue]);
  
  // Handle manual sync event
  useEffect(() => {
    const handleManualSync = () => forceSyncNow();
    window.addEventListener('manual-sync-attempt', handleManualSync);
    return () => window.removeEventListener('manual-sync-attempt', handleManualSync);
  }, [forceSyncNow]);

  // Setup WebSocket connection
  useEffect(() => {
    if (!user) return;
    
    const setupWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      try {
        setStatus('connecting');
        setLastConnectionAttempt(new Date());
        
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;
        
        ws.onopen = () => {
          console.log('WebSocket connected');
          setStatus('connected');
          
          // Authenticate with server
          ws.send(JSON.stringify({
            type: 'auth',
            userId: user.id,
            username: user.username
          }));
          
          // Try to send any queued messages
          processOfflineQueue();
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setLastMessage(data);
            
            // Handle database status updates
            if (data.type === 'database_status') {
              setIsDatabaseDown(!data.connected);
            }
          } catch (error) {
            console.error('Error handling WebSocket message:', error);
          }
        };
        
        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setStatus('disconnected');
          
          // Try to reconnect after delay
          setTimeout(() => {
            if (socketRef.current !== ws) return; // Another connection was already made
            setupWebSocket();
          }, 5000);
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setStatus('error');
        };
      } catch (error) {
        console.error('Error setting up WebSocket:', error);
        setStatus('error');
        
        // Try again after delay
        setTimeout(setupWebSocket, 5000);
      }
    };
    
    setupWebSocket();
    
    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [user, processOfflineQueue]);
  
  // Send a message with offline fallback
  const sendMessage = useCallback((message: any) => {
    // Try to send if we're connected
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && !isDatabaseDown) {
      try {
        socketRef.current.send(JSON.stringify(message));
        return;
      } catch (error) {
        console.error('Error sending message, queueing instead:', error);
      }
    }
    
    // Store message for later if sending failed
    console.log('Storing message in offline queue:', message);
    offlineQueueRef.current.push(message);
    setPendingMessageCount(offlineQueueRef.current.length);
    localStorage.setItem('offline_message_queue', JSON.stringify(offlineQueueRef.current));
  }, [isDatabaseDown]);
  
  return (
    <WebSocketContext.Provider value={{
      status,
      sendMessage,
      lastMessage,
      isDatabaseDown,
      pendingMessageCount,
      lastConnectionAttempt,
      forceSyncNow
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);