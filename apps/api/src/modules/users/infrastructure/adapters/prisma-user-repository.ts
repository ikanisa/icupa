import type { PrismaClient } from '@prisma/client';
import { createPrismaEntityRepository } from '../../shared/prisma-entity-repository.js';
import type { UserRepository } from '../../domain/ports.js';
import { userEntity } from '../../domain/entities.js';

export const createPrismaUserRepository = (prisma: PrismaClient): UserRepository =>
  createPrismaEntityRepository<typeof userEntity>({
    create: (args) => prisma.user.create(args),
    findUnique: (args) => prisma.user.findUnique(args),
    findMany: () => prisma.user.findMany()
  });
