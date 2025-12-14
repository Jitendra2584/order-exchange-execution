// Jest setup file
// This file runs before all tests

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.DB_URL = process.env.TEST_DB_URL || process.env.DB_URL;
process.env.REDIS_URL = process.env.TEST_REDIS_URL || "redis://localhost:6379";

// Increase timeout for integration tests
jest.setTimeout(10000);

// Global cleanup after all tests
afterAll(async () => {
  // Give time for async operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  // Force close any remaining Redis connections
  try {
    const { redisClient } = require("../src/services/RedisClient");
    if (redisClient && redisClient.status === "ready") {
      await redisClient.quit();
    }
  } catch (error) {
    // Ignore cleanup errors
  }
});
