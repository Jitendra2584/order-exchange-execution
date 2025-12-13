import Fastify from "fastify";
import websocket from "@fastify/websocket";
import dotenv from "dotenv";
import { AppDataSource } from "./data-source";
import { orderRoutes } from "./routes/orders";
import { redisClient } from "./services/RedisClient";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "127.0.0.1";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      transport: {
        target: "pino-pretty",
        options: {
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname"
        }
      }
    }
  });



  // Register WebSocket support
  await app.register(websocket);

  // Health check endpoint
  app.get("/", async (request, reply) => {
    return {
      status: "ok",
      message: "Order Execution Engine API",
      timestamp: new Date().toISOString(),
      endpoints: {
        health: "GET /health",
        createOrder: "POST /api/orders/execute",
        orderStatus: "WS /api/orders/status/:orderId"
      }
    };
  });

  app.get("/health", async (request, reply) => {
    const dbConnected = AppDataSource.isInitialized;
    const redisConnected = redisClient.status === "ready";

    const health = {
      status: dbConnected && redisConnected ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      services: {
        database: dbConnected ? "connected" : "disconnected",
        redis: redisConnected ? "connected" : "disconnected"
      }
    };

    const statusCode = health.status === "healthy" ? 200 : 503;
    return reply.code(statusCode).send(health);
  });

  // Register order routes
  await app.register(orderRoutes, { prefix: "/api/orders" });

  // Error handler
  app.setErrorHandler((error:any, request, reply) => {
    app.log.error(error);
    reply.status(500).send({
      error: "Internal Server Error",
      message: error.message
    });
  });

  return app;
}

export async function startServer() {
  try {
    // Initialize database
    console.log("🔄 Connecting to database...");
    await AppDataSource.initialize();
    console.log("✅ Database connected successfully");

    // Build and start the app
    const app = await buildApp();

    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Server is running on http://${HOST}:${PORT}`);
    console.log(`📡 WebSocket endpoint: ws://${HOST}:${PORT}/api/orders/status/:orderId`);

    // Graceful shutdown
    const shutdown = async () => {
      console.log("\n🔄 Shutting down gracefully...");
      await app.close();
      await AppDataSource.destroy();
      await redisClient.quit();
      console.log("✅ Server shut down successfully");
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

  } catch (error) {
    console.error("❌ Error starting server:", error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}
