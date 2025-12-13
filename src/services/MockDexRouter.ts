import { DEXName } from "../entities/Order";
import { DexQuoteResult, SwapResult } from "../types";

export class MockDexRouter {
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateMockTxHash(): string {
    return `mock-tx-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  private getBasePrice(tokenIn: string, tokenOut: string): number {
    // Mock base prices for common token pairs
    const pairKey = `${tokenIn}-${tokenOut}`;
    const basePrices: Record<string, number> = {
      "SOL-USDC": 95.5,
      "SOL-USDT": 95.3,
      "USDC-SOL": 0.01047,
      "USDT-SOL": 0.01049,
      "SOL-RAY": 190.5,
      "RAY-SOL": 0.00525,
      "USDC-USDT": 0.9998,
      "USDT-USDC": 1.0002
    };

    return basePrices[pairKey] || 100;
  }

  /**
   * Fetches a quote from Raydium DEX
   * Simulates 200ms network delay
   * Returns price with 98-102% variance from base price
   */
  async getRaydiumQuote(
    tokenIn: string,
    tokenOut: string,
    amount: number
  ): Promise<DexQuoteResult> {
    // Simulate network delay
    await this.sleep(200);

    const basePrice = this.getBasePrice(tokenIn, tokenOut);
    // Raydium: 98-102% price variance, 0.3% fee
    const price = basePrice * (0.98 + Math.random() * 0.04);
    const fee = 0.003;
    const estimatedOutput = amount * price * (1 - fee);

    console.log(`[Raydium] Quote for ${amount} ${tokenIn} -> ${tokenOut}: Price=${price.toFixed(4)}, Fee=${fee}, Output=${estimatedOutput.toFixed(4)}`);

    return {
      dexName: DEXName.RAYDIUM,
      price,
      fee,
      estimatedOutput
    };
  }

  /**
   * Fetches a quote from Meteora DEX
   * Simulates 200ms network delay
   * Returns price with 97-102% variance from base price
   */
  async getMeteorQuote(
    tokenIn: string,
    tokenOut: string,
    amount: number
  ): Promise<DexQuoteResult> {
    // Simulate network delay
    await this.sleep(200);

    const basePrice = this.getBasePrice(tokenIn, tokenOut);
    // Meteora: 97-102% price variance, 0.2% fee
    const price = basePrice * (0.97 + Math.random() * 0.05);
    const fee = 0.002;
    const estimatedOutput = amount * price * (1 - fee);

    console.log(`[Meteora] Quote for ${amount} ${tokenIn} -> ${tokenOut}: Price=${price.toFixed(4)}, Fee=${fee}, Output=${estimatedOutput.toFixed(4)}`);

    return {
      dexName: DEXName.METEORA,
      price,
      fee,
      estimatedOutput
    };
  }

  /**
   * Fetches quotes from both DEXs in parallel
   */
  async getAllQuotes(
    tokenIn: string,
    tokenOut: string,
    amount: number
  ): Promise<DexQuoteResult[]> {
    const [raydiumQuote, meteoraQuote] = await Promise.all([
      this.getRaydiumQuote(tokenIn, tokenOut, amount),
      this.getMeteorQuote(tokenIn, tokenOut, amount)
    ]);

    return [raydiumQuote, meteoraQuote];
  }

  /**
   * Compares quotes and selects the best DEX based on estimated output
   */
  selectBestDex(quotes: DexQuoteResult[]): DexQuoteResult {
    const bestQuote = quotes.reduce((best, current) => {
      return current.estimatedOutput > best.estimatedOutput ? current : best;
    });

    console.log(`[DEX Router] Selected ${bestQuote.dexName} with output ${bestQuote.estimatedOutput.toFixed(4)} (better than alternatives)`);

    return bestQuote;
  }

  /**
   * Executes a swap on the selected DEX
   * Simulates 2-3 second execution time
   * Returns mock transaction hash and executed price
   */
  async executeSwap(
    dex: DEXName,
    tokenIn: string,
    tokenOut: string,
    amount: number,
    slippage: number,
    quote: DexQuoteResult
  ): Promise<SwapResult> {
    // Simulate 2-3 second execution
    const executionTime = 2000 + Math.random() * 1000;
    await this.sleep(executionTime);

    // Simulate small price impact (within slippage)
    const priceImpact = Math.random() * slippage * 0.8; // Use 80% of allowed slippage
    const executedPrice = quote.price * (1 - priceImpact);
    const amountOut = amount * executedPrice * (1 - quote.fee);

    const txHash = this.generateMockTxHash();

    console.log(`[${dex}] Swap executed: ${amount} ${tokenIn} -> ${amountOut.toFixed(4)} ${tokenOut}`);
    console.log(`[${dex}] TX Hash: ${txHash}, Executed Price: ${executedPrice.toFixed(4)}`);

    return {
      txHash,
      executedPrice,
      amountOut
    };
  }

  /**
   * Complete routing and execution flow
   */
  async routeAndExecute(
    tokenIn: string,
    tokenOut: string,
    amount: number,
    slippage: number
  ): Promise<{ selectedDex: DEXName; quotes: DexQuoteResult[]; swapResult: SwapResult }> {
    // Get quotes from all DEXs
    const quotes = await this.getAllQuotes(tokenIn, tokenOut, amount);

    // Select best DEX
    const bestQuote = this.selectBestDex(quotes);

    // Execute swap
    const swapResult = await this.executeSwap(
      bestQuote.dexName,
      tokenIn,
      tokenOut,
      amount,
      slippage,
      bestQuote
    );

    return {
      selectedDex: bestQuote.dexName,
      quotes,
      swapResult
    };
  }
}
