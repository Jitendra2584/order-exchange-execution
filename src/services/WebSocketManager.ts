import { WebSocket } from "@fastify/websocket";
import { OrderStatusUpdate } from "../types";

interface WebSocketConnection {
  socket: WebSocket;
}

export class WebSocketManager {
  private connections: Map<string, WebSocketConnection> = new Map();

  /**
   * Register a WebSocket connection for an order
   */
  registerConnection(orderId: string, connection: WebSocketConnection): void {
    this.connections.set(orderId, connection);
    console.log(`[WebSocket] Connection registered for order ${orderId}`);

    // Handle disconnection
    connection.socket.on("close", () => {
      this.connections.delete(orderId);
      console.log(`[WebSocket] Connection closed for order ${orderId}`);
    });

    connection.socket.on("error", (error: Error) => {
      console.error(`[WebSocket] Error for order ${orderId}:`, error);
      this.connections.delete(orderId);
    });
  }

  /**
   * Send status update to a specific order's WebSocket connection
   */
  sendStatusUpdate(orderId: string, update: OrderStatusUpdate): void {
    const connection = this.connections.get(orderId);

    if (connection && connection.socket.readyState === 1) { // 1 = OPEN
      try {
        connection.socket.send(JSON.stringify(update));
        console.log(`[WebSocket] Sent update to ${orderId}:`, update.status);
      } catch (error) {
        console.error(`[WebSocket] Failed to send update to ${orderId}:`, error);
      }
    } else {
      console.warn(`[WebSocket] No active connection for order ${orderId}`);
    }
  }

  /**
   * Close connection for a specific order
   */
  closeConnection(orderId: string): void {
    const connection = this.connections.get(orderId);
    if (connection) {
      connection.socket.close();
      this.connections.delete(orderId);
      console.log(`[WebSocket] Connection closed for order ${orderId}`);
    }
  }

  /**
   * Get count of active connections
   */
  getActiveConnectionsCount(): number {
    return this.connections.size;
  }

  /**
   * Close all connections
   */
  closeAllConnections(): void {
    this.connections.forEach((connection, orderId) => {
      connection.socket.close();
      console.log(`[WebSocket] Closing connection for order ${orderId}`);
    });
    this.connections.clear();
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
