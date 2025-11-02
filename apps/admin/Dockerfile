# syntax=docker/dockerfile:1.7

# Builder stage: install dependencies and compile the Next.js app
FROM node:20-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm && pnpm --version
WORKDIR /repo

# Copy manifest files required for dependency resolution first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin/package.json apps/admin/package.json
COPY packages ./packages
COPY libs ./libs
COPY components.json ./components.json
COPY tsconfig.base.json tsconfig.json tsconfig.app.json tsconfig.node.json ./

# Install only the dependencies needed for the target workspace
RUN pnpm install --filter @icupa/admin... --frozen-lockfile

# Copy the remaining source files
COPY apps ./apps
COPY public ./public
COPY src ./src

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
RUN pnpm --filter @icupa/admin... build

# Runtime stage: distroless image with the standalone output
FROM gcr.io/distroless/nodejs20-debian12 AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

COPY --from=build /repo/apps/admin/.next/standalone ./
COPY --from=build /repo/apps/admin/.next/static ./.next/static
COPY --from=build /repo/apps/admin/public ./public

EXPOSE 3000
CMD ["server.js"]
