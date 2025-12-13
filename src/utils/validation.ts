import { z } from "zod";
import { OrderType } from "../entities/Order";

export const OrderRequestSchema = z.object({
  tokenIn: z.string().min(1).max(50),
  tokenOut: z.string().min(1).max(50),
  amountIn: z.number().positive(),
  slippage: z.number().min(0).max(1), // 0 to 1 (0% to 100%)
  orderType: z.nativeEnum(OrderType).optional().default(OrderType.MARKET)
});

export type ValidatedOrderRequest = z.infer<typeof OrderRequestSchema>;

export function validateOrderRequest(data: unknown): ValidatedOrderRequest {
  return OrderRequestSchema.parse(data);
}
