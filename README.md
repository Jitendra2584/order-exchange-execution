# Order Execution Engine

A high-performance order execution engine for cryptocurrency trading with intelligent DEX routing, real-time WebSocket updates, and concurrent order processing.

## 🎯 Overview

This system processes **Market Orders** with automatic routing between Raydium and Meteora DEXs, selecting the best execution price in real-time. Built with Node.js, TypeScript, Fastify, BullMQ, and TypeORM.

### Why Market Orders?

Market orders were chosen as the primary order type because they:
- Execute immediately at the best available price
- Are the most commonly used order type in trading
- Demonstrate core DEX routing and price comparison logic
- Provide a solid foundation for the system architecture

### Extension to Other Order Types

The architecture is designed to easily support additional order types:

- **Limit Orders**: Add a price monitoring service that continuously checks DEX prices against the target price. When the target is reached, trigger the existing market order execution flow.

- **Sniper Orders**: Implement a blockchain event listener to monitor for token launches or migrations. Upon detection, immediately trigger the market order execution flow with the new token pair.

Both extensions reuse the same DEX routing, queue management, and WebSocket notification systems already built into the engine.

---

## 🚀 **QUICK START - TEST THE ENGINE IN 30 SECONDS!** 🚀

> **No setup required!** Just open the WebSocket client in your browser and start testing.

### Step 1: Open the WebSocket Client

1. Open **Chrome browser**
2. Open this file: **[examples/websocket-client.html](examples/websocket-client.html)**
   - Or drag the file into Chrome
3. Open **Chrome DevTools** (F12 or Cmd+Option+I)
4. Go to **Console** tab

### Step 2: Submit Test Orders

#### **Test Case 1: Basic SOL to USDC Order**

**Input** (in the HTML form):
- **Token In:** `SOL`
- **Token Out:** `USDC`
- **Amount In:** `1.5`
- **Slippage:** `1` (means 1%)
- Click **"Execute Order"**

**Expected Output** (in the UI):
```
1. Order created: <orderId>
2. ● Connected
3. [Status] PENDING - Order received and queued
4. [Status] ROUTING - Comparing DEX prices
   - DEX Quotes shown with prices
   - Selected DEX (RAYDIUM or METEORA)
5. [Status] BUILDING - Creating transaction
6. [Status] SUBMITTED - Transaction sent to network
7. [Status] CONFIRMED - Transaction confirmed successfully
   - TX Hash: mock-tx-xxxxx
   - Execution Price: ~95.xx
```

**Expected in Chrome DevTools Console:**
```
WebSocket connected
Status update: {orderId: "...", status: "PENDING", ...}
Status update: {orderId: "...", status: "ROUTING", quotes: [...]}
Status update: {orderId: "...", status: "CONFIRMED", txHash: "..."}
```



### Step 3: Test Multiple Concurrent Orders

1. Click **"Execute Order"** 5 times quickly (without waiting)
2. Watch all 5 orders process concurrently
3. Each should show all status updates in real-time

**Expected:** All 5 orders complete successfully

### Step 4: Test Different Token Pairs

#### **Test Case 2: USDC to SOL**
- **Token In:** `USDC`
- **Token Out:** `SOL`
- **Amount In:** `100`
- **Slippage:** `1.5`

**Expected:** Similar flow but with different prices (~0.01 SOL per USDC)

#### **Test Case 3: High Slippage**
- **Token In:** `SOL`
- **Token Out:** `USDC`
- **Amount In:** `10`
- **Slippage:** `5` (5% slippage)

**Expected:** Order completes with higher slippage tolerance

---

## ✨ Features

- ✅ **Market Order Execution** - Immediate execution at best available price
- ✅ **Smart DEX Routing** - Automatic price comparison between Raydium and Meteora
- ✅ **Real-time Updates** - WebSocket status streaming throughout order lifecycle
- ✅ **Concurrent Processing** - Handles up to 10 orders simultaneously
- ✅ **High Throughput** - Process 100 orders per minute
- ✅ **Retry Logic** - Exponential backoff with up to 3 attempts
- ✅ **Order History** - PostgreSQL persistence for all orders and quotes
- ✅ **Comprehensive Tests** - 20+ unit and integration tests

## 🏗️ Architecture

### System Components

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ POST /api/orders/execute
       │
┌──────▼──────────────────────────────┐
│      Fastify API Server             │
│  ┌────────────────────────────┐     │
│  │  Order Validation (Zod)    │     │
│  └────────────┬───────────────┘     │
│               │                     │
│  ┌────────────▼───────────────┐     │
│  │  Create Order in DB        │     │
│  └────────────┬───────────────┘     │
│               │                     │
│  ┌────────────▼───────────────┐     │
│  │  Upgrade to WebSocket      │     │
│  └────────────┬───────────────┘     │
└───────────────┼─────────────────────┘
                │
┌───────────────▼─────────────────────┐
│      BullMQ Queue (Redis)           │
│  • Concurrency: 10 workers          │
│  • Rate Limit: 100 orders/min       │
│  • Retry: 3 attempts w/ backoff     │
└───────────────┬─────────────────────┘
                │
┌───────────────▼─────────────────────┐
│      Order Processor                │
│  ┌────────────────────────────┐     │
│  │ 1. PENDING                 │     │
│  │ 2. ROUTING (get quotes)    │     │
│  │ 3. BUILDING (create tx)    │     │
│  │ 4. SUBMITTED (execute)     │     │
│  │ 5. CONFIRMED / FAILED      │     │
│  └────────────┬───────────────┘     │
└────────────────┼───────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
┌───────▼──────┐  ┌──────▼───────┐
│   Raydium    │  │   Meteora    │
│  Mock DEX    │  │   Mock DEX   │
│ • 200ms delay│  │ • 200ms delay│
│ • 0.3% fee   │  │ • 0.2% fee   │
│ • 98-102%    │  │ • 97-102%    │
│   variance   │  │   variance   │
└──────────────┘  └──────────────┘
```

### Order Lifecycle

```
POST /api/orders/execute
    ↓
[PENDING] Order received and queued
    ↓
[ROUTING] Fetching quotes from Raydium & Meteora
    ↓
Compare prices → Select best DEX
    ↓
[BUILDING] Creating transaction
    ↓
[SUBMITTED] Sending to network
    ↓
[CONFIRMED] ✅ txHash + execution price
    OR
[FAILED] ❌ Error message + retry count
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis server
- pnpm (recommended) or npm

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd order-execution-engine
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   NODE_ENV=development
   HOST=0.0.0.0
   LOG_LEVEL=info

   # Database Configuration
   DB_URL=postgresql://user:password@host:port/database

   # Redis Configuration
   REDIS_URL=redis://localhost:6379
   ```

4. **Start Redis** (if running locally)
   ```bash
   redis-server
   ```

5. **Run the development server**
   ```bash
   pnpm dev
   ```

   The server will start on `http://localhost:3000`

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

## 📡 API Endpoints

### REST API

#### POST `/api/orders/execute`
Create a new market order

**Request:**
```json
{
  "tokenIn": "SOL",
  "tokenOut": "USDC",
  "amountIn": 1.5,
  "slippage": 0.01
}
```

**Response:**
```json
{
  "orderId": "uuid-here",
  "message": "Order created successfully. Upgrade to WebSocket for status updates.",
  "orderDetails": {
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amountIn": 1.5,
    "slippage": 0.01,
    "status": "PENDING"
  }
}
```

```
#### GET `/health`
Health check endpoint

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-14T00:00:00.000Z",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### WebSocket API

#### WS `/api/orders/status/:orderId`
Connect to receive real-time order status updates

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:3000/api/orders/status/your-order-id');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log(update);
};
```

**Status Update Messages:**

```json
// 1. Connection confirmed
{
  "orderId": "uuid",
  "status": "PENDING",
  "message": "Connected to order status updates",
  "orderDetails": {...}
}

// 2. Routing DEX prices
{
  "orderId": "uuid",
  "status": "ROUTING",
  "message": "Comparing DEX prices",
  "quotes": [
    {
      "dexName": "RAYDIUM",
      "price": 95.2,
      "fee": 0.003,
      "estimatedOutput": 142.234
    },
    {
      "dexName": "METEORA",
      "price": 95.8,
      "fee": 0.002,
      "estimatedOutput": 143.105
    }
  ],
  "selectedDex": "METEORA"
}

// 3. Building transaction
{
  "orderId": "uuid",
  "status": "BUILDING",
  "message": "Creating transaction"
}

// 4. Submitted to network
{
  "orderId": "uuid",
  "status": "SUBMITTED",
  "message": "Transaction sent to network"
}

// 5. Confirmed (Success)
{
  "orderId": "uuid",
  "status": "CONFIRMED",
  "message": "Transaction confirmed successfully",
  "txHash": "mock-tx-1234567890-abc123",
  "executionPrice": 95.42,
  "selectedDex": "METEORA"
}

// OR Failed
{
  "orderId": "uuid",
  "status": "FAILED",
  "message": "Order execution failed",
  "error": "Insufficient liquidity",
  "retryCount": 3
}
```

## 🧪 Testing

The project includes comprehensive tests covering:

1. **Mock DEX Router** - Quote fetching, price comparison, swap execution
2. **Validation** - Request validation with edge cases
3. **Order Lifecycle** - End-to-end order processing
4. **Queue Behavior** - Concurrent processing and retry logic
5. **WebSocket** - Connection management and status updates

Run tests with:
```bash
pnpm test
```

## 📦 Postman Collection

Import the `postman_collection.json` file into Postman or Insomnia to test all API endpoints.

The collection includes:
- Health check
- Create market orders (various examples)

## 🔧 Tech Stack

- **Backend**: Node.js 18+ with TypeScript
- **Web Framework**: Fastify (high-performance, WebSocket support)
- **Queue System**: BullMQ + Redis
- **Database**: PostgreSQL with TypeORM
- **Validation**: Zod
- **Testing**: Jest + ts-jest
- **Logging**: Pino

## 🎯 Design Decisions

### 1. Fastify over Express
- Built-in WebSocket support
- Better performance (2x faster)
- Schema-based validation
- Modern async/await patterns

### 2. BullMQ for Queue Management
- Redis-backed reliability
- Built-in retry with exponential backoff
- Concurrency control
- Rate limiting
- Job prioritization support

### 3. TypeORM for Database
- Type-safe database operations
- Easy migration management
- Relationship mapping
- Query builder

### 4. Mock DEX Implementation
- Focus on architecture and flow
- Realistic delays and price variations
- Demonstrates routing logic
- Easy to replace with real DEX SDKs

### 5. WebSocket for Status Updates
- Real-time user experience
- Reduced polling overhead
- Connection per order
- Automatic cleanup


### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=warn

DB_URL=<your-postgres-url>
REDIS_URL=<your-redis-url>
```

## 📊 Performance

- **Concurrent Orders**: Up to 10 simultaneous orders
- **Throughput**: 100 orders per minute
- **DEX Quote Latency**: ~200ms per DEX (parallel fetching)
- **Execution Time**: 2-3 seconds per order
- **Retry Strategy**: Exponential backoff (0s, 2s, 4s)

## 🔐 Error Handling

The system handles various error scenarios:
- Invalid order parameters (Zod validation)
- Database connection failures
- Redis connection issues
- DEX unavailability (mocked)
- WebSocket disconnections
- Transaction failures

All errors are:
- Logged with context
- Returned to client via WebSocket
- Persisted in database for analysis
- Trigger retry logic when appropriate

## 📈 Future Enhancements

1. **Limit Order Support** - Price monitoring and conditional execution
2. **Sniper Order Support** - Token launch detection
3. **Real DEX Integration** - Replace mocks with Raydium/Meteora SDKs
4. **Advanced Routing** - Multi-hop routing, liquidity aggregation
5. **Analytics Dashboard** - Order metrics and DEX performance
6. **User Authentication** - API keys and rate limiting per user
7. **Webhook Notifications** - Alternative to WebSocket
8. **Order Cancellation** - Cancel pending orders

## 🤝 Contributing


Built with ❤️ using TypeScript, Fastify, and BullMQ
