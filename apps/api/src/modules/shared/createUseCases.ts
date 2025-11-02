import { z } from 'zod';
import type { AuditLogger, EntityRepository, RateLimiter } from './ports.js';

export interface UseCaseBundle<Schema extends z.ZodTypeAny> {
  create(input: z.infer<Schema>, context: UseCaseContext): Promise<z.infer<Schema>>;
  getById(id: string, context: UseCaseContext): Promise<z.infer<Schema>>;
  list(context: UseCaseContext): Promise<Array<z.infer<Schema>>>;
}

export interface UseCaseContext {
  actorId: string;
  correlationId: string;
}

export const createUseCases = <Schema extends z.ZodTypeAny>(
  schema: Schema,
  repository: EntityRepository<Schema>,
  auditLogger: AuditLogger,
  rateLimiter: RateLimiter,
  resourceName: string
): UseCaseBundle<Schema> => ({
  async create(input, context) {
    const payload = schema.parse(input);
    await rateLimiter.consume(`${context.actorId}:${resourceName}:create`);
    auditLogger.record(`${resourceName}.create`, { ...payload, ...context });
    return repository.create(payload);
  },
  async getById(id, context) {
    await rateLimiter.consume(`${context.actorId}:${resourceName}:read`);
    auditLogger.record(`${resourceName}.get`, { id, ...context });
    const entity = await repository.findById(id);
    if (!entity) {
      throw Object.assign(new Error(`${resourceName} not found`), {
        status: 404,
        details: { id }
      });
    }
    return entity;
  },
  async list(context) {
    await rateLimiter.consume(`${context.actorId}:${resourceName}:list`);
    auditLogger.record(`${resourceName}.list`, { ...context });
    return repository.list();
  }
});
