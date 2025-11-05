import type { AnyZodObject } from 'zod';
import { z } from 'zod';

export interface EntityRepository<Schema extends AnyZodObject> {
  create(data: z.infer<Schema>): Promise<z.infer<Schema>>;
  findById(id: string): Promise<z.infer<Schema> | null>;
  list(): Promise<Array<z.infer<Schema>>>;
}

export interface AuditLogger {
  record(event: string, payload: Record<string, unknown>): void;
}

export interface RateLimiter {
  consume(key: string): Promise<void>;
}
