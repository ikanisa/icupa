import type { PrismaClient } from '@prisma/client';
import { createPrismaEntityRepository } from '../../shared/prisma-entity-repository.js';
import type { TenantRepository } from '../../domain/ports.js';
import { tenantEntity } from '../../domain/entities.js';

export const createPrismaTenantRepository = (prisma: PrismaClient): TenantRepository =>
  createPrismaEntityRepository<typeof tenantEntity>({
    create: (args) => prisma.tenant.create(args),
    findUnique: (args) => prisma.tenant.findUnique(args),
    findMany: () => prisma.tenant.findMany()
  });
