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
   * Creates an order and immediately adds it to the processing queue
   * Returns orderId - client should then connect to WebSocket for real-time status updates
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

        // Add order to processing queue IMMEDIATELY
        try {
          await addOrderToQueue(order.id);
          console.log(`[Queue] Added order ${order.id} to queue`);
        } catch (error) {
          console.error(`[Queue] Error adding order ${order.id} to queue:`, error);
          return reply.code(500).send({
            error: "Failed to queue order for processing",
            orderId: order.id
          });
        }

        // Return order ID
        return reply.code(201).send({
          orderId: order.id,
          message: "Order created and queued for processing. Connect to WebSocket for real-time status updates.",
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
   * WebSocket route for real-time order status updates
   * ws://localhost:3000/api/orders/status/:orderId
   *
   * Note: Order processing begins immediately when created via POST /api/orders/execute
   * WebSocket connection is optional and only used for monitoring real-time updates
   * Multiple clients can connect to the same order for monitoring
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

      // Register WebSocket connection and send any buffered updates
      await wsManager.registerConnection(orderId, { socket });

      // Send initial status (after buffered updates)
      socket.send(JSON.stringify({
        orderId: order.id,
        status: order.status,
        message: "Connected to order status updates. Order is already processing.",
        orderDetails: {
          tokenIn: order.tokenIn,
          tokenOut: order.tokenOut,
          amountIn: order.amountIn,
          slippage: order.slippage
        }
      }));

      // Note: Order was already added to queue when it was created via POST /api/orders/execute
      // WebSocket is only for monitoring real-time updates
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
