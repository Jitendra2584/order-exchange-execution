import { MockDexRouter } from "../src/services/MockDexRouter";
import { DEXName } from "../src/entities/Order";

describe("MockDexRouter", () => {
  let dexRouter: MockDexRouter;

  beforeEach(() => {
    dexRouter = new MockDexRouter();
  });

  describe("getRaydiumQuote", () => {
    it("should return a valid quote from Raydium", async () => {
      const quote = await dexRouter.getRaydiumQuote("SOL", "USDC", 1);

      expect(quote).toBeDefined();
      expect(quote.dexName).toBe(DEXName.RAYDIUM);
      expect(quote.price).toBeGreaterThan(0);
      expect(quote.fee).toBe(0.003);
      expect(quote.estimatedOutput).toBeGreaterThan(0);
    });

    it("should simulate network delay", async () => {
      const startTime = Date.now();
      await dexRouter.getRaydiumQuote("SOL", "USDC", 1);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeGreaterThanOrEqual(200);
    });

    it("should calculate estimated output correctly", async () => {
      const amountIn = 10;
      const quote = await dexRouter.getRaydiumQuote("SOL", "USDC", amountIn);

      const expectedOutput = amountIn * quote.price * (1 - quote.fee);
      expect(quote.estimatedOutput).toBeCloseTo(expectedOutput, 4);
    });
  });

  describe("getMeteorQuote", () => {
    it("should return a valid quote from Meteora", async () => {
      const quote = await dexRouter.getMeteorQuote("SOL", "USDC", 1);

      expect(quote).toBeDefined();
      expect(quote.dexName).toBe(DEXName.METEORA);
      expect(quote.price).toBeGreaterThan(0);
      expect(quote.fee).toBe(0.002);
      expect(quote.estimatedOutput).toBeGreaterThan(0);
    });

    it("should have lower fees than Raydium", async () => {
      const meteoraQuote = await dexRouter.getMeteorQuote("SOL", "USDC", 1);
      const raydiumQuote = await dexRouter.getRaydiumQuote("SOL", "USDC", 1);

      expect(meteoraQuote.fee).toBeLessThan(raydiumQuote.fee);
    });
  });

  describe("getAllQuotes", () => {
    it("should return quotes from both DEXs", async () => {
      const quotes = await dexRouter.getAllQuotes("SOL", "USDC", 1);

      expect(quotes).toHaveLength(2);
      expect(quotes.some(q => q.dexName === DEXName.RAYDIUM)).toBe(true);
      expect(quotes.some(q => q.dexName === DEXName.METEORA)).toBe(true);
    });

    it("should fetch quotes in parallel", async () => {
      const startTime = Date.now();
      await dexRouter.getAllQuotes("SOL", "USDC", 1);
      const endTime = Date.now();

      // Should take ~200ms (parallel) not ~400ms (sequential)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(350);
    });
  });

  describe("selectBestDex", () => {
    it("should select DEX with highest estimated output", async () => {
      const quotes = await dexRouter.getAllQuotes("SOL", "USDC", 1);
      const bestQuote = dexRouter.selectBestDex(quotes);

      const maxOutput = Math.max(...quotes.map(q => q.estimatedOutput));
      expect(bestQuote.estimatedOutput).toBe(maxOutput);
    });

    it("should always return one of the provided quotes", async () => {
      const quotes = await dexRouter.getAllQuotes("SOL", "USDC", 1);
      const bestQuote = dexRouter.selectBestDex(quotes);

      expect(quotes).toContainEqual(bestQuote);
    });
  });

  describe("executeSwap", () => {
    it("should execute swap and return valid result", async () => {
      const quote = await dexRouter.getRaydiumQuote("SOL", "USDC", 1);
      const result = await dexRouter.executeSwap(
        DEXName.RAYDIUM,
        "SOL",
        "USDC",
        1,
        0.01,
        quote
      );

      expect(result).toBeDefined();
      expect(result.txHash).toBeDefined();
      expect(result.txHash).toMatch(/^mock-tx-/);
      expect(result.executedPrice).toBeGreaterThan(0);
      expect(result.amountOut).toBeGreaterThan(0);
    });

    it("should simulate execution delay of 2-3 seconds", async () => {
      const quote = await dexRouter.getRaydiumQuote("SOL", "USDC", 1);

      const startTime = Date.now();
      await dexRouter.executeSwap(DEXName.RAYDIUM, "SOL", "USDC", 1, 0.01, quote);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeGreaterThanOrEqual(2000);
      expect(duration).toBeLessThan(3500);
    });

    it("should apply slippage protection", async () => {
      const quote = await dexRouter.getRaydiumQuote("SOL", "USDC", 1);
      const slippage = 0.01; // 1%

      const result = await dexRouter.executeSwap(
        DEXName.RAYDIUM,
        "SOL",
        "USDC",
        1,
        slippage,
        quote
      );

      // Executed price should be within slippage tolerance
      const minAcceptablePrice = quote.price * (1 - slippage);
      expect(result.executedPrice).toBeGreaterThanOrEqual(minAcceptablePrice);
      expect(result.executedPrice).toBeLessThanOrEqual(quote.price);
    });
  });

  describe("routeAndExecute", () => {
    it("should complete full routing and execution flow", async () => {
      const result = await dexRouter.routeAndExecute("SOL", "USDC", 1, 0.01);

      expect(result).toBeDefined();
      expect(result.selectedDex).toBeDefined();
      expect([DEXName.RAYDIUM, DEXName.METEORA]).toContain(result.selectedDex);
      expect(result.quotes).toHaveLength(2);
      expect(result.swapResult).toBeDefined();
      expect(result.swapResult.txHash).toBeDefined();
      expect(result.swapResult.executedPrice).toBeGreaterThan(0);
    });
  });
});
