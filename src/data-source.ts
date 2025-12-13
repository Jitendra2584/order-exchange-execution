import { DataSource } from "typeorm";
import dotenv from "dotenv";
import { Order } from "./entities/Order";
import { DEXQuote } from "./entities/DEXQuote";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DB_URL,
  synchronize: false,
  logging: true,
  entities: [Order, DEXQuote],
  ssl: true, // Enable SSL for secure connections
  extra: {
    connectionLimit: 10, // Optional: Set a connection limit for the pool
    idleTimeoutMillis: 30000,
    ssl: { rejectUnauthorized: false }
  },
});