import type { z } from 'zod';
import type { EntityRepository } from './ports.js';

type Delegate<Schema extends z.ZodTypeAny> = {
  create: (args: { data: z.infer<Schema> }) => Promise<z.infer<Schema>>;
  findUnique: (args: { where: { id: string } }) => Promise<z.infer<Schema> | null>;
  findMany: (args?: Record<string, unknown>) => Promise<Array<z.infer<Schema>>>;
};

export const createPrismaEntityRepository = <Schema extends z.ZodTypeAny>(
  delegate: Delegate<Schema>
): EntityRepository<Schema> => ({
  create(data) {
    return delegate.create({ data });
  },
  findById(id) {
    return delegate.findUnique({ where: { id } });
  },
  list() {
    return delegate.findMany();
  }
});
