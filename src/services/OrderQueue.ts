import { Queue, Worker, QueueEvents } from "bullmq";
import { redisClient } from "./RedisClient";
import { OrderProcessor } from "./OrderProcessor";

const QUEUE_NAME = "order-execution-queue";

// Create the queue
export const orderQueue = new Queue(QUEUE_NAME, {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3, // Maximum 3 retry attempts
    backoff: {
      type: "exponential",
      delay: 2000 // Start with 2 seconds, doubles each retry
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600 // Remove after 24 hours
    },
    removeOnFail: {
      count: 500 // Keep last 500 failed jobs for analysis
    }
  }
});

// Create the worker
const orderProcessor = new OrderProcessor();

export const orderWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { orderId } = job.data;
    console.log(`[Queue Worker] Processing order ${orderId}, attempt ${job.attemptsMade + 1}/${job.opts.attempts}`);

    try {
      await orderProcessor.processOrder(orderId, job.attemptsMade);
      console.log(`[Queue Worker] Successfully processed order ${orderId}`);
    } catch (error) {
      console.error(`[Queue Worker] Error processing order ${orderId}:`, error);
      throw error; // Re-throw to trigger retry logic
    }
  },
  {
    connection: redisClient,
    concurrency: 10, // Process up to 10 orders concurrently
    limiter: {
      max: 100, // Maximum 100 jobs
      duration: 60 * 1000 // Per minute (60 seconds)
    }
  }
);

// Queue events for monitoring
const queueEvents = new QueueEvents(QUEUE_NAME, { connection: redisClient });

queueEvents.on("completed", ({ jobId }) => {
  console.log(`[Queue Events] Job ${jobId} completed successfully`);
});

queueEvents.on("failed", ({ jobId, failedReason }) => {
  console.error(`[Queue Events] Job ${jobId} failed:`, failedReason);
});

// Note: 'retrying' event is not available in QueueEvents
// Retry attempts are logged in the Worker processor instead

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Queue] Gracefully shutting down...");
  await orderWorker.close();
  await orderQueue.close();
  await queueEvents.close();
  process.exit(0);
});

export async function addOrderToQueue(orderId: string): Promise<void> {
  await orderQueue.add("process-order", { orderId }, {
    jobId: orderId // Use orderId as jobId to prevent duplicates
  });
  console.log(`[Queue] Added order ${orderId} to queue`);
}
