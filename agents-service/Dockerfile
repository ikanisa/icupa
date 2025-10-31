# syntax=docker/dockerfile:1.7

# Pin base image to specific digest for security
# Update monthly by checking: docker pull node:20-slim && docker inspect node:20-slim
FROM node:20-slim@sha256:a22f79e64de59efd3533828aecc9817bfdc1cd37dde598aa27d6065e7b1f0abc AS deps
WORKDIR /usr/src/app

# Create non-root user early
RUN groupadd --gid 1000 node \
  && useradd --uid 1000 --gid node --shell /bin/bash --create-home node 2>/dev/null || true

# Install dependencies as node user
COPY --chown=node:node agents-service/package.json ./package.json
COPY --chown=node:node agents-service/package-lock.json ./package-lock.json

USER node
RUN npm ci --ignore-scripts

FROM deps AS build
USER root
COPY --chown=node:node agents-service/tsconfig.json ./tsconfig.json
COPY --chown=node:node agents-service/src ./src
USER node
RUN npm run build

FROM node:20-slim@sha256:a22f79e64de59efd3533828aecc9817bfdc1cd37dde598aa27d6065e7b1f0abc AS runtime
WORKDIR /usr/src/app
ENV NODE_ENV=production

# Create non-root user
RUN groupadd --gid 1000 node \
  && useradd --uid 1000 --gid node --shell /bin/bash --create-home node 2>/dev/null || true

# Copy package metadata for npm prune to respect dependency graph
COPY --chown=node:node agents-service/package.json ./package.json
COPY --from=deps --chown=node:node /usr/src/app/node_modules ./node_modules

USER node
RUN npm prune --omit=dev && npm cache clean --force

COPY --from=build --chown=node:node /usr/src/app/dist ./dist

EXPOSE 8787

ENV AGENTS_HOST=0.0.0.0 \
    AGENTS_PORT=8787 \
    OTEL_SERVICE_NAME=icupa-agents-service

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "
import http from 'node:http';
const req = http.request({
  host: '127.0.0.1',
  port: process.env.AGENTS_PORT || 8787,
  path: '/health',
  timeout: 4000,
}, (res) => {
  if (res.statusCode && res.statusCode < 500) {
    process.exit(0);
  }
  process.exit(1);
});
req.on('error', () => process.exit(1));
req.end();
"

USER node
CMD ["node", "--enable-source-maps", "dist/server.js"]
