import type { PrismaClient } from '@prisma/client';
import { createPrismaEntityRepository } from '../../shared/prisma-entity-repository.js';
import type { InventoryRepository } from '../../domain/ports.js';
import { inventoryEntity } from '../../domain/entities.js';

export const createPrismaInventoryRepository = (prisma: PrismaClient): InventoryRepository =>
  createPrismaEntityRepository<typeof inventoryEntity>({
    create: (args) => prisma.inventoryItem.create(args),
    findUnique: (args) => prisma.inventoryItem.findUnique(args),
    findMany: () => prisma.inventoryItem.findMany()
  });
