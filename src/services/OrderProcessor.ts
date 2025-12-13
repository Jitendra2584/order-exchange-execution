import { AppDataSource } from "../data-source";
import { Order, OrderStatus } from "../entities/Order";
import { DEXQuote } from "../entities/DEXQuote";
import { MockDexRouter } from "./MockDexRouter";
import { wsManager } from "./WebSocketManager";
import { OrderStatusUpdate } from "../types";

export class OrderProcessor {
  private dexRouter: MockDexRouter;
  private orderRepository = AppDataSource.getRepository(Order);
  private quoteRepository = AppDataSource.getRepository(DEXQuote);

  constructor() {
    this.dexRouter = new MockDexRouter();
  }

  /**
   * Main order processing logic
   */
  async processOrder(orderId: string, attemptsMade: number): Promise<void> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    try {
      // Update retry count
      order.retryCount = attemptsMade;
      await this.orderRepository.save(order);

      // Step 1: PENDING status
      await this.updateOrderStatus(order, OrderStatus.PENDING, "Order received and queued");

      // Step 2: ROUTING status - Fetch quotes from DEXs
      await this.updateOrderStatus(order, OrderStatus.ROUTING, "Comparing DEX prices");
      const quotes = await this.dexRouter.getAllQuotes(order.tokenIn, order.tokenOut, order.amountIn);

      // Save quotes to database
      for (const quoteData of quotes) {
        const quote = this.quoteRepository.create({
          orderId: order.id,
          dexName: quoteData.dexName,
          price: quoteData.price,
          fee: quoteData.fee,
          estimatedOutput: quoteData.estimatedOutput
        });
        await this.quoteRepository.save(quote);
      }

      // Select best DEX
      const bestQuote = this.dexRouter.selectBestDex(quotes);
      order.selectedDex = bestQuote.dexName;
      await this.orderRepository.save(order);

      // Send routing update with quotes
      this.sendStatusUpdate(order.id, {
        orderId: order.id,
        status: OrderStatus.ROUTING,
        message: "DEX routing completed",
        quotes: quotes,
        selectedDex: bestQuote.dexName
      });

      // Step 3: BUILDING status - Create transaction
      await this.updateOrderStatus(order, OrderStatus.BUILDING, "Creating transaction");

      // Simulate transaction building delay
      await this.sleep(500);

      // Step 4: SUBMITTED status - Execute swap
      await this.updateOrderStatus(order, OrderStatus.SUBMITTED, "Transaction sent to network");

      const swapResult = await this.dexRouter.executeSwap(
        bestQuote.dexName,
        order.tokenIn,
        order.tokenOut,
        order.amountIn,
        order.slippage,
        bestQuote
      );

      // Step 5: CONFIRMED status
      order.status = OrderStatus.CONFIRMED;
      order.txHash = swapResult.txHash;
      order.executionPrice = swapResult.executedPrice;
      await this.orderRepository.save(order);

      this.sendStatusUpdate(order.id, {
        orderId: order.id,
        status: OrderStatus.CONFIRMED,
        message: "Transaction confirmed successfully",
        txHash: swapResult.txHash,
        executionPrice: swapResult.executedPrice,
        selectedDex: bestQuote.dexName
      });

      console.log(`[Order Processor] ✅ Order ${orderId} completed successfully`);

      // Close WebSocket connection after confirmation
      setTimeout(() => {
        wsManager.closeConnection(order.id);
      }, 2000);

    } catch (error) {
      console.error(`[Order Processor] ❌ Error processing order ${orderId}:`, error);

      // Update order as failed
      order.status = OrderStatus.FAILED;
      order.errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      await this.orderRepository.save(order);

      // Send failure update
      this.sendStatusUpdate(order.id, {
        orderId: order.id,
        status: OrderStatus.FAILED,
        message: "Order execution failed",
        error: order.errorMessage,
        retryCount: order.retryCount
      });

      // Close WebSocket connection after failure
      setTimeout(() => {
        wsManager.closeConnection(order.id);
      }, 2000);

      throw error; // Re-throw to trigger retry in BullMQ
    }
  }

  /**
   * Update order status and send WebSocket notification
   */
  private async updateOrderStatus(order: Order, status: OrderStatus, message: string): Promise<void> {
    order.status = status;
    await this.orderRepository.save(order);

    this.sendStatusUpdate(order.id, {
      orderId: order.id,
      status,
      message
    });
  }

  /**
   * Send status update via WebSocket
   */
  private sendStatusUpdate(orderId: string, update: OrderStatusUpdate): void {
    wsManager.sendStatusUpdate(orderId, update);
  }

  /**
   * Helper sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
