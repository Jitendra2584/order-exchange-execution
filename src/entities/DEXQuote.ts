import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, UpdateDateColumn } from "typeorm";
import { Order } from "./Order";
import { DEXName } from "./enums";

@Entity("dex_quotes")
export class DEXQuote {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  orderId!: string;

  @ManyToOne(() => Order, order => order.dexQuotes)
  @JoinColumn({ name: "orderId" })
  order!: Order;

  @Column({
    type: "enum",
    enum: DEXName
  })
  dexName!: DEXName;

  @Column({ type: "decimal", precision: 20, scale: 8 })
  price!: number;

  @Column({ type: "decimal", precision: 5, scale: 4 })
  fee!: number;

  @Column({ type: "decimal", precision: 20, scale: 8 })
  estimatedOutput!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
