import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { WebSocket } from "@fastify/websocket";
import { AppDataSource } from "../data-source";
import { Order, OrderStatus } from "../entities/Order";
import { addOrderToQueue } from "../services/OrderQueue";
import { wsManager } from "../services/WebSocketManager";
import { validateOrderRequest } from "../utils/validation";

export async function orderRoutes(fastify: FastifyInstance) {
  const orderRepository = AppDataSource.getRepository(Order);

  /**
   * POST /api/orders/execute
   * Creates an order and upgrades to WebSocket for status updates
   */
  fastify.route({
    method: "POST",
    url: "/execute",
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Validate request body
        const validatedData = validateOrderRequest(request.body);

        // Create order in database
        const order = orderRepository.create({
          orderType: validatedData.orderType,
          tokenIn: validatedData.tokenIn,
          tokenOut: validatedData.tokenOut,
          amountIn: validatedData.amountIn,
          slippage: validatedData.slippage,
          status: OrderStatus.PENDING
        });

        await orderRepository.save(order);

        console.log(`[API] Created order ${order.id}: ${order.amountIn} ${order.tokenIn} -> ${order.tokenOut}`);

        // Return order ID
        return reply.code(201).send({
          orderId: order.id,
          message: "Order created successfully. Upgrade to WebSocket for status updates.",
          orderDetails: {
            tokenIn: order.tokenIn,
            tokenOut: order.tokenOut,
            amountIn: order.amountIn,
            slippage: order.slippage,
            status: order.status
          }
        });
      } catch (error) {
        console.error("[API] Error creating order:", error);

        if (error instanceof Error && error.name === "ZodError") {
          return reply.code(400).send({
            error: "Validation error",
            details: error.message
          });
        }

        return reply.code(500).send({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  });

  /**
   * WebSocket route for order status updates
   * ws://localhost:3000/api/orders/status/:orderId
   */
  fastify.register(async function (fastify) {
    fastify.get("/status/:orderId", { websocket: true }, async (socket: WebSocket, request: FastifyRequest) => {
      const { orderId } = request.params as { orderId: string };

      console.log(`[WebSocket] Client connected for order ${orderId}`);

      // Verify order exists
      const order = await orderRepository.findOne({ where: { id: orderId } });

      if (!order) {
        socket.send(JSON.stringify({
          error: "Order not found",
          orderId
        }));
        socket.close();
        return;
      }

      // Register WebSocket connection
      wsManager.registerConnection(orderId, { socket });

      // Send initial status
      socket.send(JSON.stringify({
        orderId: order.id,
        status: order.status,
        message: "Connected to order status updates",
        orderDetails: {
          tokenIn: order.tokenIn,
          tokenOut: order.tokenOut,
          amountIn: order.amountIn,
          slippage: order.slippage
        }
      }));

      // Add order to processing queue
      try {
        await addOrderToQueue(orderId);
      } catch (error) {
        console.error(`[WebSocket] Error adding order ${orderId} to queue:`, error);
        socket.send(JSON.stringify({
          orderId,
          status: "FAILED",
          error: "Failed to queue order for processing"
        }));
      }
    });
  });

  /**
   * GET /api/orders/:orderId
   * Fetch order details
   */
  fastify.get("/:orderId", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { orderId } = request.params as { orderId: string };

      const order = await orderRepository.findOne({
        where: { id: orderId },
        relations: ["dexQuotes"]
      });

      if (!order) {
        return reply.code(404).send({
          error: "Order not found"
        });
      }

      return reply.send({
        orderId: order.id,
        orderType: order.orderType,
        tokenIn: order.tokenIn,
        tokenOut: order.tokenOut,
        amountIn: order.amountIn,
        slippage: order.slippage,
        status: order.status,
        selectedDex: order.selectedDex,
        executionPrice: order.executionPrice,
        txHash: order.txHash,
        errorMessage: order.errorMessage,
        retryCount: order.retryCount,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        quotes: order.dexQuotes
      });
    } catch (error) {
      console.error("[API] Error fetching order:", error);
      return reply.code(500).send({
        error: "Internal server error"
      });
    }
  });

  /**
   * GET /api/orders
   * List all orders with optional status filter
   */
  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { status, limit = 50 } = request.query as { status?: OrderStatus; limit?: number };

      const queryBuilder = orderRepository.createQueryBuilder("order");

      if (status) {
        queryBuilder.where("order.status = :status", { status });
      }

      const orders = await queryBuilder
        .orderBy("order.createdAt", "DESC")
        .take(Number(limit))
        .getMany();

      return reply.send({
        count: orders.length,
        orders: orders.map(order => ({
          orderId: order.id,
          orderType: order.orderType,
          tokenIn: order.tokenIn,
          tokenOut: order.tokenOut,
          amountIn: order.amountIn,
          status: order.status,
          selectedDex: order.selectedDex,
          executionPrice: order.executionPrice,
          txHash: order.txHash,
          createdAt: order.createdAt
        }))
      });
    } catch (error) {
      console.error("[API] Error listing orders:", error);
      return reply.code(500).send({
        error: "Internal server error"
      });
    }
  });
}
