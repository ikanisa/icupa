# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base
WORKDIR /src
COPY apps/ocr-converter ./app

FROM gcr.io/distroless/nodejs20-debian12 AS runner
WORKDIR /app
COPY --from=base /src/app ./
ENV NODE_ENV=production \
    PORT=8788
EXPOSE 8788
CMD ["server.mjs"]
