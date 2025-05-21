import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

// Define custom WebSocket type with user properties
export interface ExtendedWebSocket extends WebSocket {
  userId?: number;
  username?: string;
}

// Global WebSocket server instance
let wssInstance: WebSocketServer | null = null;

// Initialize WebSocket server
export function initializeWebSocketServer(httpServer: Server): WebSocketServer {
  // Create WebSocket server for real-time messaging if not already created
  if (!wssInstance) {
    wssInstance = new WebSocketServer({ 
      server: httpServer, 
      path: '/ws',
      clientTracking: true
    });
    
    console.log('WebSocket server initialized');
  }
  
  return wssInstance;
}

// Get WebSocket server instance
export function getWebSocketServer(): WebSocketServer | null {
  return wssInstance;
}

// Safely broadcast a message to all clients
export function broadcastToAllClients(message: any): void {
  const wss = getWebSocketServer();
  
  if (!wss) {
    console.error('WebSocket server not initialized');
    return;
  }
  
  try {
    wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  } catch (error) {
    console.error('Error broadcasting message:', error);
  }
}

// Broadcast a message to a specific user
export function broadcastToUser(userId: number, message: any): void {
  const wss = getWebSocketServer();
  
  if (!wss) {
    console.error('WebSocket server not initialized');
    return;
  }
  
  try {
    wss.clients.forEach((client: ExtendedWebSocket) => {
      if (client.readyState === WebSocket.OPEN && client.userId === userId) {
        client.send(JSON.stringify(message));
      }
    });
  } catch (error) {
    console.error(`Error broadcasting message to user ${userId}:`, error);
  }
}

// Broadcast a message to a channel
export function broadcastToChannel(channelId: number, message: any): void {
  const wss = getWebSocketServer();
  
  if (!wss) {
    console.error('WebSocket server not initialized');
    return;
  }
  
  try {
    // Implementation would depend on how you track channel memberships
    wss.clients.forEach((client: ExtendedWebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        // In a real implementation, you'd check if the user is in the channel
        client.send(JSON.stringify({
          ...message,
          channelId
        }));
      }
    });
  } catch (error) {
    console.error(`Error broadcasting message to channel ${channelId}:`, error);
  }
}

// Safely broadcast database status to all clients
export function broadcastDatabaseStatus(isConnected: boolean): void {
  broadcastToAllClients({
    type: 'database_status',
    connected: isConnected,
    timestamp: new Date().toISOString()
  });
}