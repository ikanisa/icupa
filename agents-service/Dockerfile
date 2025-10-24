# syntax=docker/dockerfile:1.7

FROM node:20-slim AS deps
WORKDIR /usr/src/app

COPY agents-service/package.json ./package.json
COPY agents-service/package-lock.json ./package-lock.json
RUN npm ci

FROM deps AS build
COPY agents-service/tsconfig.json ./tsconfig.json
COPY agents-service/src ./src
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /usr/src/app
ENV NODE_ENV=production

# Copy package metadata for npm prune to respect dependency graph
COPY agents-service/package.json ./package.json
COPY --from=deps /usr/src/app/node_modules ./node_modules
RUN npm prune --omit=dev && npm cache clean --force

COPY --from=build /usr/src/app/dist ./dist

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
