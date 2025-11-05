import type { PrismaClient } from '@prisma/client';
import { createPrismaEntityRepository } from '../../shared/prisma-entity-repository.js';
import type { SearchRepository } from '../../domain/ports.js';
import { searchDocumentEntity } from '../../domain/entities.js';

export const createPrismaSearchRepository = (prisma: PrismaClient): SearchRepository =>
  createPrismaEntityRepository<typeof searchDocumentEntity>({
    create: (args) => prisma.searchDocument.create(args),
    findUnique: (args) => prisma.searchDocument.findUnique(args),
    findMany: () => prisma.searchDocument.findMany()
  });
