// Jest setup file
// This file runs before all tests

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.DB_URL = process.env.TEST_DB_URL || process.env.DB_URL;
process.env.REDIS_URL = process.env.TEST_REDIS_URL || "redis://localhost:6379";

// Increase timeout for integration tests
jest.setTimeout(10000);
