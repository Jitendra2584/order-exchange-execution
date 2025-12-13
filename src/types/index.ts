import { OrderType, OrderStatus, DEXName } from "../entities/Order";


export interface OrderRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  slippage: number;
  orderType?: OrderType;
}

export interface DexQuoteResult {
  dexName: DEXName;
  price: number;
  fee: number;
  estimatedOutput: number;
}

export interface SwapResult {
  txHash: string;
  executedPrice: number;
  amountOut: number;
}

export interface OrderStatusUpdate {
  orderId: string;
  status: OrderStatus;
  message: string;
  quotes?: DexQuoteResult[];
  selectedDex?: DEXName;
  txHash?: string;
  executionPrice?: number;
  error?: string;
  retryCount?: number;
}

export { OrderType, OrderStatus, DEXName };
