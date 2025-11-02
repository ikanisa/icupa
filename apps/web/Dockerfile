# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm && pnpm --version
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages ./packages
COPY libs ./libs
COPY components.json ./components.json
COPY tsconfig.base.json tsconfig.json tsconfig.app.json tsconfig.node.json ./

RUN pnpm install --filter icupa-web... --frozen-lockfile

COPY apps ./apps
COPY public ./public
COPY src ./src

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
RUN pnpm --filter icupa-web... build

FROM gcr.io/distroless/nodejs20-debian12 AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./.next/static
COPY --from=build /repo/apps/web/public ./public

EXPOSE 3000
CMD ["server.js"]
