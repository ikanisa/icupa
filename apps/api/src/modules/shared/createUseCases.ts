import { randomUUID } from 'node:crypto';
import { ZodDate, type AnyZodObject, z } from 'zod';
import type { AuditLogger, EntityRepository, RateLimiter } from './ports.js';

export interface UseCaseBundle<Schema extends AnyZodObject> {
  create(input: z.input<Schema>, context: UseCaseContext): Promise<z.infer<Schema>>;
  getById(id: string, context: UseCaseContext): Promise<z.infer<Schema>>;
  list(context: UseCaseContext): Promise<Array<z.infer<Schema>>>;
}

export interface UseCaseContext {
  actorId: string;
  correlationId: string;
}

const coerceInput = <Schema extends AnyZodObject>(schema: Schema, input: z.input<Schema>) => {
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  const normalised: Record<string, unknown> = { ...input };

  for (const [key, definition] of Object.entries(shape)) {
    if (definition instanceof ZodDate && key in normalised) {
      const value = normalised[key];
      if (value instanceof Date || value === undefined || value === null) {
        continue;
      }

      const parsed = new Date(value as string | number);
      if (Number.isNaN(parsed.getTime())) {
        throw Object.assign(new Error(`Invalid date value for field "${key}"`), {
          status: 400
        });
      }
      normalised[key] = parsed;
    }
  }

  const now = new Date();

  if ('id' in shape && (normalised['id'] === undefined || normalised['id'] === null)) {
    normalised['id'] = randomUUID();
  }

  if ('createdAt' in shape && (normalised['createdAt'] === undefined || normalised['createdAt'] === null)) {
    normalised['createdAt'] = now;
  }

  if ('updatedAt' in shape && (normalised['updatedAt'] === undefined || normalised['updatedAt'] === null)) {
    normalised['updatedAt'] = now;
  }

  return normalised as z.input<Schema>;
};

export const createUseCases = <Schema extends AnyZodObject>(
  schema: Schema,
  repository: EntityRepository<Schema>,
  auditLogger: AuditLogger,
  rateLimiter: RateLimiter,
  resourceName: string
): UseCaseBundle<Schema> => ({
  async create(input, context) {
    const payload = schema.parse(coerceInput(schema, input));
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
