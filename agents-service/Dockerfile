# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS deps
WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY agents-service/package.json agents-service/package-lock.json ./
RUN npm ci --ignore-scripts

FROM deps AS build
COPY agents-service/tsconfig.json ./tsconfig.json
COPY agents-service/src ./src
RUN npm run build --prefix .

FROM deps AS prune
RUN npm prune --omit=dev && npm cache clean --force

FROM gcr.io/distroless/nodejs20-debian12 AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production \
    AGENTS_HOST=0.0.0.0 \
    AGENTS_PORT=8787 \
    OTEL_SERVICE_NAME=icupa-agents-service

COPY --from=prune /usr/src/app/node_modules ./node_modules
COPY agents-service/package.json ./package.json
COPY --from=build /usr/src/app/dist ./dist

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["node", "-e", "const http=require('node:http');const req=http.request({host:'127.0.0.1',port:process.env.AGENTS_PORT||8787,path:'/health',timeout:4000},(res)=>{if(res.statusCode&&res.statusCode<500){process.exit(0);}process.exit(1);});req.on('error',()=>process.exit(1));req.end();"]

CMD ["dist/server.js"]
