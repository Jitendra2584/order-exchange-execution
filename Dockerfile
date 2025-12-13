# Build stage
FROM node:20-alpine AS builder

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.21.0 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .


# Build TypeScript code
RUN pnpm run build

# Production stage
FROM node:20-alpine

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.21.0 --activate

# Set working directory
WORKDIR /app

COPY public ./public

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Expose port (adjust if your app uses a different port)
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]
