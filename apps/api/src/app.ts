import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { RateLimiterRes } from 'rate-limiter-flexible';
import { ZodError } from 'zod';
import { httpLogger } from './infrastructure/observability/logger.js';
import { registerRoutes } from './presentation/http/routes.js';
import { moduleRegistry } from './modules/index.js';
import { sanitizeRequest } from './presentation/http/sanitizer.js';
import { env } from './config/env.js';
import { startTracing } from './infrastructure/observability/tracing.js';
import { v4 as uuid } from 'uuid';
import rateLimit from 'express-rate-limit';
import client from 'prom-client';

startTracing();

const metricsRegistry = new client.Registry();
client.collectDefaultMetrics({ register: metricsRegistry });

const requestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status']
});
metricsRegistry.registerMetric(requestCounter);

export const createApp = (registry = moduleRegistry) => {
  const app = express();

  app.use((req, res, next) => {
    res.locals.correlationId = req.headers['x-correlation-id'] ?? uuid();
    res.setHeader('x-correlation-id', res.locals.correlationId);
    next();
  });

  app.use(rateLimit({ windowMs: 60_000, max: 100 }));
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(sanitizeRequest);
  app.use(httpLogger);

  app.use((req, res, next) => {
    res.on('finish', () => {
      requestCounter.inc({ method: req.method, route: req.path, status: res.statusCode });
    });
    next();
  });

  registerRoutes(app, registry);

  app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (_req, res) => {
    try {
      await registry.users.list({ actorId: 'system', correlationId: 'healthcheck' });
      res.json({ status: 'ready' });
    } catch (error) {
      res.status(503).json({ status: 'degraded', error: (error as Error).message });
    }
  });

  app.get('/metrics', async (_req, res) => {
    res.setHeader('Content-Type', metricsRegistry.contentType);
    res.send(await metricsRegistry.metrics());
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    let status = 500;
    let message = 'Unknown error';
    let details: unknown;

    if (error instanceof ZodError) {
      status = 400;
      message = 'Validation failed';
      details = error.flatten();
    } else if (error instanceof RateLimiterRes) {
      status = 429;
      message = 'Too many requests';
      details = { retryAfter: Math.ceil(error.msBeforeNext / 1000) };
    } else if (typeof error === 'object' && error && 'status' in error) {
      status = (error as { status: number }).status;
    }

    if (error instanceof Error && !(error instanceof ZodError)) {
      message = error.message;
    }

    const payload: Record<string, unknown> = {
      message,
      correlationId: res.locals.correlationId
    };

    if (details) {
      payload.details = details;
    }

    res.status(status).json({
      error: payload
    });
  });

  return app;
};

export const start = () => {
  const app = createApp();
  return app.listen(env.PORT, () => {
    console.log(`API listening on port ${env.PORT}`);
  });
};
