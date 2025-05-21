import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './use-auth';

// Simple WebSocket context type
interface WebSocketContextType {
  status: string;
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

// Simplified WebSocket Provider
export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [status] = useState('connected');
  const [lastMessage] = useState<any>(null);
  const [isDatabaseDown] = useState(false);

  // Simple send function that logs messages
  const sendMessage = useCallback((message: any) => {
    console.log('[WebSocket] Message would be sent:', message);
    
    // Store in localStorage for offline queue simulation
    try {
      const queue = JSON.parse(localStorage.getItem('offline_message_queue') || '[]');
      queue.push({
        type: message.type,
        data: message,
        timestamp: Date.now()
      });
      localStorage.setItem('offline_message_queue', JSON.stringify(queue));
    } catch (e) {
      console.error('Error saving to offline queue:', e);
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ status, sendMessage, lastMessage, isDatabaseDown }}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Custom hook to use the WebSocket context
export const useWebSocket = () => useContext(WebSocketContext);