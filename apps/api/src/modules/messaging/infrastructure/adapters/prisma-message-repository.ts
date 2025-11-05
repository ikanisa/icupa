import type { PrismaClient } from '@prisma/client';
import { createPrismaEntityRepository } from '../../shared/prisma-entity-repository.js';
import type { MessageRepository } from '../../domain/ports.js';
import { messageEntity } from '../../domain/entities.js';

export const createPrismaMessageRepository = (prisma: PrismaClient): MessageRepository =>
  createPrismaEntityRepository<typeof messageEntity>({
    create: (args) => prisma.message.create(args),
    findUnique: (args) => prisma.message.findUnique(args),
    findMany: () => prisma.message.findMany()
  });
