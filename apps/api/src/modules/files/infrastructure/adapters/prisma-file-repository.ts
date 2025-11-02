import type { PrismaClient } from '@prisma/client';
import { createPrismaEntityRepository } from '../../shared/prisma-entity-repository.js';
import type { FileRepository } from '../../domain/ports.js';
import { fileEntity } from '../../domain/entities.js';

export const createPrismaFileRepository = (prisma: PrismaClient): FileRepository =>
  createPrismaEntityRepository<typeof fileEntity>({
    create: (args) => prisma.fileObject.create(args),
    findUnique: (args) => prisma.fileObject.findUnique(args),
    findMany: () => prisma.fileObject.findMany()
  });
