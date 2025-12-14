import { WebSocketManager } from "../src/services/WebSocketManager";
import { OrderStatus } from "../src/entities/Order";
import { redisClient } from "../src/services/RedisClient";

// Mock WebSocket
class MockWebSocket {
  readyState = 1; // OPEN
  sentMessages: string[] = [];
  eventHandlers: { [key: string]: Function[] } = {};

  send(data: string) {
    this.sentMessages.push(data);
  }

  on(event: string, handler: Function) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.eventHandlers["close"]) {
      this.eventHandlers["close"].forEach(handler => handler());
    }
  }

  trigger(event: string, ...args: any[]) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(...args));
    }
  }
}

describe("WebSocketManager", () => {
  let wsManager: WebSocketManager;
  let mockSocket: MockWebSocket;
  const testOrderId = "test-order-123";

  beforeEach(async () => {
    // Create a new instance for each test
    wsManager = new WebSocketManager();
    mockSocket = new MockWebSocket();

    // Clear any existing buffered updates in Redis
    const bufferKey = `order:${testOrderId}:updates`;
    await redisClient.del(bufferKey);
  });

  afterEach(async () => {
    // Clean up Redis
    const bufferKey = `order:${testOrderId}:updates`;
    await redisClient.del(bufferKey);
  });

  describe("registerConnection", () => {
    it("should register a WebSocket connection", async () => {
      await wsManager.registerConnection(testOrderId, { socket: mockSocket as any });

      expect(wsManager.getActiveConnectionsCount()).toBe(1);
    });

    it("should send buffered updates when connection is registered", async () => {
      // Buffer some updates first
      await wsManager.sendStatusUpdate(testOrderId, {
        orderId: testOrderId,
        status: OrderStatus.PENDING,
        message: "Order queued"
      });

      await wsManager.sendStatusUpdate(testOrderId, {
        orderId: testOrderId,
        status: OrderStatus.ROUTING,
        message: "Fetching quotes"
      });

      // Now register the connection
      await wsManager.registerConnection(testOrderId, { socket: mockSocket as any });

      // Should have sent both buffered updates
      expect(mockSocket.sentMessages.length).toBe(2);

      const firstUpdate = JSON.parse(mockSocket.sentMessages[0]);
      const secondUpdate = JSON.parse(mockSocket.sentMessages[1]);

      expect(firstUpdate.status).toBe(OrderStatus.PENDING);
      expect(secondUpdate.status).toBe(OrderStatus.ROUTING);
    });

    it("should handle connection close event", async () => {
      await wsManager.registerConnection(testOrderId, { socket: mockSocket as any });

      expect(wsManager.getActiveConnectionsCount()).toBe(1);

      // Simulate close
      mockSocket.close();

      expect(wsManager.getActiveConnectionsCount()).toBe(0);
    });

    it("should handle connection error event", async () => {
      await wsManager.registerConnection(testOrderId, { socket: mockSocket as any });

      expect(wsManager.getActiveConnectionsCount()).toBe(1);

      // Simulate error
      mockSocket.trigger("error", new Error("Connection error"));

      expect(wsManager.getActiveConnectionsCount()).toBe(0);
    });
  });

  describe("sendStatusUpdate", () => {
    it("should send update immediately if connection is active", async () => {
      await wsManager.registerConnection(testOrderId, { socket: mockSocket as any });

      const update = {
        orderId: testOrderId,
        status: OrderStatus.CONFIRMED,
        message: "Order confirmed",
        txHash: "mock-tx-123",
        executionPrice: 95.5
      };

      await wsManager.sendStatusUpdate(testOrderId, update);

      expect(mockSocket.sentMessages.length).toBeGreaterThan(0);
      const lastMessage = JSON.parse(mockSocket.sentMessages[mockSocket.sentMessages.length - 1]);
      expect(lastMessage.status).toBe(OrderStatus.CONFIRMED);
      expect(lastMessage.txHash).toBe("mock-tx-123");
    });

    it("should buffer update in Redis if no connection exists", async () => {
      const update = {
        orderId: testOrderId,
        status: OrderStatus.PENDING,
        message: "Order queued"
      };

      await wsManager.sendStatusUpdate(testOrderId, update);

      // Check that update was buffered in Redis
      const bufferKey = `order:${testOrderId}:updates`;
      const bufferedUpdates = await redisClient.lrange(bufferKey, 0, -1);

      expect(bufferedUpdates.length).toBe(1);

      const bufferedUpdate = JSON.parse(bufferedUpdates[0]);
      expect(bufferedUpdate.status).toBe(OrderStatus.PENDING);
      expect(bufferedUpdate.message).toBe("Order queued");
    });

    it("should buffer update if connection is closed", async () => {
      await wsManager.registerConnection(testOrderId, { socket: mockSocket as any });

      // Close the socket
      mockSocket.readyState = 3; // CLOSED

      const update = {
        orderId: testOrderId,
        status: OrderStatus.ROUTING,
        message: "Fetching quotes"
      };

      await wsManager.sendStatusUpdate(testOrderId, update);

      // Check that update was buffered in Redis
      const bufferKey = `order:${testOrderId}:updates`;
      const bufferedUpdates = await redisClient.lrange(bufferKey, 0, -1);

      expect(bufferedUpdates.length).toBe(1);
    });

    it("should buffer multiple updates", async () => {
      const updates = [
        { orderId: testOrderId, status: OrderStatus.PENDING, message: "Queued" },
        { orderId: testOrderId, status: OrderStatus.ROUTING, message: "Routing" },
        { orderId: testOrderId, status: OrderStatus.BUILDING, message: "Building" }
      ];

      for (const update of updates) {
        await wsManager.sendStatusUpdate(testOrderId, update);
      }

      // Check Redis buffer
      const bufferKey = `order:${testOrderId}:updates`;
      const bufferedUpdates = await redisClient.lrange(bufferKey, 0, -1);

      expect(bufferedUpdates.length).toBe(3);

      const parsedUpdates = bufferedUpdates.map(u => JSON.parse(u));
      expect(parsedUpdates[0].status).toBe(OrderStatus.PENDING);
      expect(parsedUpdates[1].status).toBe(OrderStatus.ROUTING);
      expect(parsedUpdates[2].status).toBe(OrderStatus.BUILDING);
    });

    it("should handle send errors by buffering", async () => {
      await wsManager.registerConnection(testOrderId, { socket: mockSocket as any });

      // Make send throw an error
      mockSocket.send = () => {
        throw new Error("Send failed");
      };

      const update = {
        orderId: testOrderId,
        status: OrderStatus.CONFIRMED,
        message: "Order confirmed"
      };

      await wsManager.sendStatusUpdate(testOrderId, update);

      // Should have buffered the update
      const bufferKey = `order:${testOrderId}:updates`;
      const bufferedUpdates = await redisClient.lrange(bufferKey, 0, -1);

      expect(bufferedUpdates.length).toBeGreaterThan(0);
    });
  });

  describe("closeConnection", () => {
    it("should close and remove connection", async () => {
      await wsManager.registerConnection(testOrderId, { socket: mockSocket as any });

      expect(wsManager.getActiveConnectionsCount()).toBe(1);

      wsManager.closeConnection(testOrderId);

      expect(wsManager.getActiveConnectionsCount()).toBe(0);
      expect(mockSocket.readyState).toBe(3); // CLOSED
    });

    it("should do nothing if connection doesn't exist", () => {
      wsManager.closeConnection("non-existent-order");

      // Should not throw error
      expect(wsManager.getActiveConnectionsCount()).toBe(0);
    });
  });

  describe("getActiveConnectionsCount", () => {
    it("should return 0 when no connections", () => {
      expect(wsManager.getActiveConnectionsCount()).toBe(0);
    });

    it("should return correct count with multiple connections", async () => {
      const socket1 = new MockWebSocket();
      const socket2 = new MockWebSocket();
      const socket3 = new MockWebSocket();

      await wsManager.registerConnection("order-1", { socket: socket1 as any });
      await wsManager.registerConnection("order-2", { socket: socket2 as any });
      await wsManager.registerConnection("order-3", { socket: socket3 as any });

      expect(wsManager.getActiveConnectionsCount()).toBe(3);

      // Clean up
      wsManager.closeConnection("order-1");
      wsManager.closeConnection("order-2");
      wsManager.closeConnection("order-3");
    });
  });

  describe("closeAllConnections", () => {
    it("should close all active connections", async () => {
      const socket1 = new MockWebSocket();
      const socket2 = new MockWebSocket();

      await wsManager.registerConnection("order-1", { socket: socket1 as any });
      await wsManager.registerConnection("order-2", { socket: socket2 as any });

      expect(wsManager.getActiveConnectionsCount()).toBe(2);

      wsManager.closeAllConnections();

      expect(wsManager.getActiveConnectionsCount()).toBe(0);
      expect(socket1.readyState).toBe(3); // CLOSED
      expect(socket2.readyState).toBe(3); // CLOSED
    });
  });

  describe("Redis buffering with TTL", () => {
    it("should set TTL on buffered updates", async () => {
      const update = {
        orderId: testOrderId,
        status: OrderStatus.PENDING,
        message: "Order queued"
      };

      await wsManager.sendStatusUpdate(testOrderId, update);

      // Check that TTL is set
      const bufferKey = `order:${testOrderId}:updates`;
      const ttl = await redisClient.ttl(bufferKey);

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(300); // Should be <= 5 minutes
    });

    it("should clear buffer after sending buffered updates", async () => {
      // Buffer some updates
      await wsManager.sendStatusUpdate(testOrderId, {
        orderId: testOrderId,
        status: OrderStatus.PENDING,
        message: "Order queued"
      });

      // Verify buffer exists
      const bufferKey = `order:${testOrderId}:updates`;
      let bufferedUpdates = await redisClient.lrange(bufferKey, 0, -1);
      expect(bufferedUpdates.length).toBe(1);

      // Register connection (should send and clear buffer)
      await wsManager.registerConnection(testOrderId, { socket: mockSocket as any });

      // Verify buffer is cleared
      bufferedUpdates = await redisClient.lrange(bufferKey, 0, -1);
      expect(bufferedUpdates.length).toBe(0);
    });
  });

  describe("Integration: Full flow", () => {
    it("should handle complete order lifecycle with buffering", async () => {
      // Step 1: Send updates before WebSocket connects
      await wsManager.sendStatusUpdate(testOrderId, {
        orderId: testOrderId,
        status: OrderStatus.PENDING,
        message: "Order queued"
      });

      await wsManager.sendStatusUpdate(testOrderId, {
        orderId: testOrderId,
        status: OrderStatus.ROUTING,
        message: "Fetching quotes"
      });

      // Step 2: Connect WebSocket
      await wsManager.registerConnection(testOrderId, { socket: mockSocket as any });

      // Should receive buffered updates
      expect(mockSocket.sentMessages.length).toBe(2);

      // Step 3: Send real-time updates after connection
      await wsManager.sendStatusUpdate(testOrderId, {
        orderId: testOrderId,
        status: OrderStatus.BUILDING,
        message: "Building transaction"
      });

      await wsManager.sendStatusUpdate(testOrderId, {
        orderId: testOrderId,
        status: OrderStatus.CONFIRMED,
        message: "Order confirmed",
        txHash: "mock-tx-123",
        executionPrice: 95.5
      });

      // Should have all 4 messages
      expect(mockSocket.sentMessages.length).toBe(4);

      const allUpdates = mockSocket.sentMessages.map(msg => JSON.parse(msg));

      expect(allUpdates[0].status).toBe(OrderStatus.PENDING);
      expect(allUpdates[1].status).toBe(OrderStatus.ROUTING);
      expect(allUpdates[2].status).toBe(OrderStatus.BUILDING);
      expect(allUpdates[3].status).toBe(OrderStatus.CONFIRMED);

      // Step 4: Close connection
      wsManager.closeConnection(testOrderId);

      expect(wsManager.getActiveConnectionsCount()).toBe(0);
    });
  });
});
