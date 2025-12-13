import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm";
import { DEXQuote } from "./DEXQuote";
import { OrderType, OrderStatus, DEXName } from "./enums";

// Re-export enums for backward compatibility
export { OrderType, OrderStatus, DEXName };

@Entity("orders")
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({
    type: "enum",
    enum: OrderType,
    default: OrderType.MARKET
  })
  orderType!: OrderType;

  @Column({ type: "varchar", length: 50 })
  tokenIn!: string;

  @Column({ type: "varchar", length: 50 })
  tokenOut!: string;

  @Column({ type: "decimal", precision: 20, scale: 8 })
  amountIn!: number;

  @Column({ type: "decimal", precision: 5, scale: 4 })
  slippage!: number;

  @Column({
    type: "enum",
    enum: OrderStatus,
    default: OrderStatus.PENDING
  })
  status!: OrderStatus;

  @Column({
    type: "enum",
    enum: DEXName,
    nullable: true
  })
  selectedDex?: DEXName;

  @Column({ type: "decimal", precision: 20, scale: 8, nullable: true })
  executionPrice?: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  txHash?: string;

  @Column({ type: "text", nullable: true })
  errorMessage?: string;

  @Column({ type: "int", default: 0 })
  retryCount!: number;

  @OneToMany(() => DEXQuote, quote => quote.order)
  dexQuotes?: DEXQuote[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;


}
