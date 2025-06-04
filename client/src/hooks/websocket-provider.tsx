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
    // Only setup WebSocket if user is authenticated
    if (!user) {
      // Clear any existing connection and set status to disconnected without logging
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setStatus('disconnected');
      return;
    }
    
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
            
            console.log('WebSocket message received:', data.type, data);
            
            // Handle database status updates
            if (data.type === 'database_status') {
              setIsDatabaseDown(!data.connected);
            }
            
            // Handle direct message events and dispatch custom events
            if (data.type === 'new_direct_message' || data.type === 'direct_message_sent') {
              console.log('Dispatching direct message event:', data);
              const directMessageEvent = new CustomEvent('direct-message-received', {
                detail: data
              });
              window.dispatchEvent(directMessageEvent);
            }
            
            // Handle channel message events and dispatch custom events
            if (data.type === 'new_channel_message') {
              console.log('*** WEBSOCKET-PROVIDER: Processing channel message ***');
              console.log('Channel message data:', data);
              const channelMessageEvent = new CustomEvent('channel-message-received', {
                detail: data
              });
              window.dispatchEvent(channelMessageEvent);
            }
          } catch (error) {
            console.error('Error handling WebSocket message:', error);
          }
        };
        
        ws.onclose = () => {
          // Only log disconnection and attempt reconnection if user is still authenticated
          if (user) {
            console.log('WebSocket disconnected');
            setStatus('disconnected');
            
            // Try to reconnect after delay only if user is still authenticated
            setTimeout(() => {
              if (socketRef.current !== ws || !user) return; // Another connection was already made or user logged out
              setupWebSocket();
            }, 5000);
          }
        };
        
        ws.onerror = (error) => {
          // Only log errors if user is authenticated
          if (user) {
            console.error('WebSocket error:', error);
            setStatus('error');
          }
        };
      } catch (error) {
        // Only log errors and retry if user is authenticated
        if (user) {
          console.error('Error setting up WebSocket:', error);
          setStatus('error');
          
          // Try again after delay
          setTimeout(setupWebSocket, 5000);
        }
      }
    };
    
    setupWebSocket();
    
    // Cleanup on unmount or user logout
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [user, processOfflineQueue]);
  
  // Enhanced send message function with improved offline support
  const sendMessage = useCallback((message: any) => {
    // Add clientId and timestamp if missing to help with message tracking
    const enhancedMessage = {
      ...message,
      clientId: message.clientId || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: message.timestamp || Date.now(),
      userId: user?.id // Add user ID for better message tracking
    };
    
    // Store a backup in type-specific storage for recovery
    const messageType = enhancedMessage.type || 'unknown';
    try {
      // Store in type-specific storage for better recovery options
      const storageKey = `offline_${messageType}_messages`;
      const existingMessages = JSON.parse(localStorage.getItem(storageKey) || '[]');
      existingMessages.push({
        ...enhancedMessage,
        queuedAt: Date.now(),
        recoveryId: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      });
      localStorage.setItem(storageKey, JSON.stringify(existingMessages));
    } catch (e) {
      console.warn('Error backing up message to local storage:', e);
    }
    
    // Emit an event for UI components to potentially handle optimistic updates
    const messageEvent = new CustomEvent('websocket-message-sent', { 
      detail: { message: enhancedMessage, offline: isDatabaseDown } 
    });
    window.dispatchEvent(messageEvent);
    
    // Try to send if we're connected and database is up
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && !isDatabaseDown) {
      try {
        socketRef.current.send(JSON.stringify(enhancedMessage));
        console.log(`Message sent successfully (${messageType}): ${enhancedMessage.clientId}`);
        return;
      } catch (error) {
        console.error('Error sending message, queueing instead:', error);
      }
    }
    
    // Store message for later if sending failed or we're offline
    console.log(`Storing message in offline queue (type: ${enhancedMessage.type}):`, enhancedMessage);
    
    // Add to queue with pending status
    offlineQueueRef.current.push({
      ...enhancedMessage,
      queuedAt: Date.now(),
      attempts: 0,
      lastAttempt: null,
      offline: true // Mark specifically as offline for easier tracking
    });
    
    // Update UI indicators and persist to localStorage
    setPendingMessageCount(offlineQueueRef.current.length);
    localStorage.setItem('offline_message_queue', JSON.stringify(offlineQueueRef.current));
    
    // If this is a direct message, make sure the UI knows about its pending state
    if (enhancedMessage.type === 'direct_message') {
      const pendingEvent = new CustomEvent('direct-message-pending', { 
        detail: { message: enhancedMessage, isDatabaseDown } 
      });
      window.dispatchEvent(pendingEvent);
    }
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