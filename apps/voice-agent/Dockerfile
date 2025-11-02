# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm && pnpm --version
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/voice-agent/package.json apps/voice-agent/package.json
COPY packages ./packages
COPY libs ./libs
COPY tsconfig.base.json tsconfig.json tsconfig.node.json ./

RUN pnpm install --filter @icupa/voice-agent... --frozen-lockfile

COPY apps/voice-agent ./apps/voice-agent

RUN pnpm --filter @icupa/voice-agent... build

FROM build AS prod-deps
RUN pnpm deploy --filter @icupa/voice-agent... --prod /opt/voice-agent

FROM gcr.io/distroless/nodejs20-debian12 AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8786

COPY --from=build /repo/apps/voice-agent/dist ./dist
COPY --from=prod-deps /opt/voice-agent/package.json ./package.json
COPY --from=prod-deps /opt/voice-agent/node_modules ./node_modules

EXPOSE 8786
CMD ["dist/index.js"]
