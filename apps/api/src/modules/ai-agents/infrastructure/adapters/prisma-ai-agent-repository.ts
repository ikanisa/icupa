import type { PrismaClient } from '@prisma/client';
import { createPrismaEntityRepository } from '../../shared/prisma-entity-repository.js';
import type { AiAgentRepository } from '../../domain/ports.js';
import { aiAgentEntity } from '../../domain/entities.js';

export const createPrismaAiAgentRepository = (prisma: PrismaClient): AiAgentRepository =>
  createPrismaEntityRepository<typeof aiAgentEntity>({
    create: (args) => prisma.aiAgent.create(args),
    findUnique: (args) => prisma.aiAgent.findUnique(args),
    findMany: () => prisma.aiAgent.findMany()
  });
