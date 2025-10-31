# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY .npmrc ./

# Install pnpm
RUN npm install -g pnpm@10

# Copy workspace configuration
COPY pnpm-workspace.yaml ./

# Copy voice-agent source
COPY apps/voice-agent ./apps/voice-agent

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the application
WORKDIR /app/apps/voice-agent
RUN pnpm build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10

# Copy package files
COPY --from=builder /app/apps/voice-agent/package*.json ./
COPY --from=builder /app/apps/voice-agent/dist ./dist

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Expose port
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8787/health', (r) => {if(r.statusCode !== 200) throw new Error('Health check failed');})"

# Start the application
CMD ["node", "dist/index.js"]
