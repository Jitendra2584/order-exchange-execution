import { WebSocket } from "@fastify/websocket";
import { OrderStatusUpdate } from "../types";
import { redisClient } from "./RedisClient";

interface WebSocketConnection {
  socket: WebSocket;
}

export class WebSocketManager {
  private connections: Map<string, WebSocketConnection> = new Map();
  private readonly UPDATE_BUFFER_TTL = 300; // 5 minutes
  private readonly MAX_BUFFERED_UPDATES = 50;

  /**
   * Get the Redis key for buffering updates
   */
  private getBufferKey(orderId: string): string {
    return `order:${orderId}:updates`;
  }

  /**
   * Buffer a status update in Redis (for when WebSocket isn't connected yet)
   */
  private async bufferUpdate(orderId: string, update: OrderStatusUpdate): Promise<void> {
    try {
      const key = this.getBufferKey(orderId);
      await redisClient.rpush(key, JSON.stringify(update));
      await redisClient.expire(key, this.UPDATE_BUFFER_TTL);
      await redisClient.ltrim(key, -this.MAX_BUFFERED_UPDATES, -1);
      console.log(`[WebSocket] Buffered update for order ${orderId} in Redis`);
    } catch (error) {
      console.error(`[WebSocket] Failed to buffer update in Redis for ${orderId}:`, error);
    }
  }

  /**
   * Retrieve and send all buffered updates to the WebSocket
   */
  private async sendBufferedUpdates(orderId: string, socket: WebSocket): Promise<void> {
    try {
      const key = this.getBufferKey(orderId);
      const bufferedUpdates = await redisClient.lrange(key, 0, -1);

      if (bufferedUpdates.length > 0) {
        console.log(`[WebSocket] Sending ${bufferedUpdates.length} buffered updates for order ${orderId}`);

        for (const updateStr of bufferedUpdates) {
          if (socket.readyState === 1) { // 1 = OPEN
            socket.send(updateStr);
          }
        }

        // Clear the buffer after sending
        await redisClient.del(key);
      }
    } catch (error) {
      console.error(`[WebSocket] Failed to retrieve buffered updates for ${orderId}:`, error);
    }
  }

  /**
   * Register a WebSocket connection for an order
   */
  async registerConnection(orderId: string, connection: WebSocketConnection): Promise<void> {
    this.connections.set(orderId, connection);
    console.log(`[WebSocket] Connection registered for order ${orderId}`);

    // Send any buffered updates that were sent before WebSocket connected
    await this.sendBufferedUpdates(orderId, connection.socket);

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
   * If no connection exists, buffer the update in Redis for later delivery
   */
  async sendStatusUpdate(orderId: string, update: OrderStatusUpdate): Promise<void> {
    const connection = this.connections.get(orderId);

    if (connection && connection.socket.readyState === 1) { // 1 = OPEN
      try {
        connection.socket.send(JSON.stringify(update));
        console.log(`[WebSocket] Sent update to ${orderId}:`, update.status);
      } catch (error) {
        console.error(`[WebSocket] Failed to send update to ${orderId}:`, error);
        // If sending fails, buffer it
        await this.bufferUpdate(orderId, update);
      }
    } else {
      // No active connection - buffer the update in Redis
      console.log(`[WebSocket] No active connection for order ${orderId}, buffering update`);
      await this.bufferUpdate(orderId, update);
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
      console.log(`[WebSocket] Active connections: ${this.connections.size}`);
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
