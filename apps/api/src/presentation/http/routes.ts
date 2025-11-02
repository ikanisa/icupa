import type { Express, Response } from 'express';
import type { ModuleRegistry } from '../../modules/index.js';

const moduleRouteMap: Record<string, keyof ModuleRegistry> = {
  auth: 'auth',
  users: 'users',
  tenants: 'tenants',
  listings: 'listings',
  inventory: 'inventory',
  orders: 'orders',
  bookings: 'bookings',
  payments: 'payments',
  search: 'search',
  messaging: 'messaging',
  notifications: 'notifications',
  files: 'files',
  'ai-agents': 'aiAgents'
};

const respond = (res: Response, data: unknown, status = 200) => {
  res.status(status).json({ data });
};

export const registerRoutes = (app: Express, registry: ModuleRegistry) => {
  for (const [route, moduleKey] of Object.entries(moduleRouteMap)) {
    const useCases = registry[moduleKey];
    app.get(`/v1/${route}`, async (req, res, next) => {
      try {
        const data = await useCases.list({
          actorId: String(req.headers['x-actor-id'] ?? 'anonymous'),
          correlationId: String(res.locals.correlationId)
        });
        respond(res, data);
      } catch (error) {
        next(error);
      }
    });

    app.get(`/v1/${route}/:id`, async (req, res, next) => {
      try {
        const data = await useCases.getById(String(req.params.id), {
          actorId: String(req.headers['x-actor-id'] ?? 'anonymous'),
          correlationId: String(res.locals.correlationId)
        });
        respond(res, data);
      } catch (error) {
        next(error);
      }
    });

    app.post(`/v1/${route}`, async (req, res, next) => {
      try {
        const data = await useCases.create(req.body, {
          actorId: String(req.headers['x-actor-id'] ?? 'anonymous'),
          correlationId: String(res.locals.correlationId)
        });
        respond(res, data, 201);
      } catch (error) {
        next(error);
      }
    });
  }

  app.post('/v1/auth/login', async (req, res, next) => {
    try {
      const session = await registry.auth.login(req.body.identifier, req.body.secret);
      respond(res, session);
    } catch (error) {
      next(error);
    }
  });
};
