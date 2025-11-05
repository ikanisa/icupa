import type { PrismaClient } from '@prisma/client';
import { createPrismaEntityRepository } from '../../shared/prisma-entity-repository.js';
import type { OrderRepository } from '../../domain/ports.js';
import { orderEntity } from '../../domain/entities.js';

export const createPrismaOrderRepository = (prisma: PrismaClient): OrderRepository =>
  createPrismaEntityRepository<typeof orderEntity>({
    create: (args) => prisma.order.create(args),
    findUnique: (args) => prisma.order.findUnique(args),
    findMany: () => prisma.order.findMany()
  });
