import { validateOrderRequest } from "../src/utils/validation";
import { OrderType } from "../src/entities/Order";

describe("Order Validation", () => {
  describe("validateOrderRequest", () => {
    it("should validate a correct order request", () => {
      const validOrder = {
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: 1.5,
        slippage: 0.01
      };

      const result = validateOrderRequest(validOrder);

      expect(result).toEqual({
        ...validOrder,
        orderType: OrderType.MARKET
      });
    });

    it("should accept custom order type", () => {
      const validOrder = {
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: 1.5,
        slippage: 0.01,
        orderType: OrderType.LIMIT
      };

      const result = validateOrderRequest(validOrder);

      expect(result.orderType).toBe(OrderType.LIMIT);
    });

    it("should reject negative amountIn", () => {
      const invalidOrder = {
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: -1,
        slippage: 0.01
      };

      expect(() => validateOrderRequest(invalidOrder)).toThrow();
    });

    it("should reject zero amountIn", () => {
      const invalidOrder = {
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: 0,
        slippage: 0.01
      };

      expect(() => validateOrderRequest(invalidOrder)).toThrow();
    });

    it("should reject slippage greater than 1", () => {
      const invalidOrder = {
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: 1,
        slippage: 1.5
      };

      expect(() => validateOrderRequest(invalidOrder)).toThrow();
    });

    it("should reject negative slippage", () => {
      const invalidOrder = {
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: 1,
        slippage: -0.01
      };

      expect(() => validateOrderRequest(invalidOrder)).toThrow();
    });

    it("should reject empty tokenIn", () => {
      const invalidOrder = {
        tokenIn: "",
        tokenOut: "USDC",
        amountIn: 1,
        slippage: 0.01
      };

      expect(() => validateOrderRequest(invalidOrder)).toThrow();
    });

    it("should reject empty tokenOut", () => {
      const invalidOrder = {
        tokenIn: "SOL",
        tokenOut: "",
        amountIn: 1,
        slippage: 0.01
      };

      expect(() => validateOrderRequest(invalidOrder)).toThrow();
    });

    it("should reject missing required fields", () => {
      const invalidOrder = {
        tokenIn: "SOL",
        // Missing tokenOut, amountIn, slippage
      };

      expect(() => validateOrderRequest(invalidOrder)).toThrow();
    });

    it("should accept valid edge case values", () => {
      const edgeCaseOrder = {
        tokenIn: "SOL",
        tokenOut: "USDC",
        amountIn: 0.00000001, // Very small amount
        slippage: 1.0 // Max slippage (100%)
      };

      const result = validateOrderRequest(edgeCaseOrder);

      expect(result.amountIn).toBe(0.00000001);
      expect(result.slippage).toBe(1.0);
    });
  });
});
