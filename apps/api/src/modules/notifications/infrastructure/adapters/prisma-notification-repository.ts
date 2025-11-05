import type { PrismaClient } from '@prisma/client';
import { createPrismaEntityRepository } from '../../shared/prisma-entity-repository.js';
import type { NotificationRepository } from '../../domain/ports.js';
import { notificationEntity } from '../../domain/entities.js';

export const createPrismaNotificationRepository = (prisma: PrismaClient): NotificationRepository =>
  createPrismaEntityRepository<typeof notificationEntity>({
    create: (args) => prisma.notification.create(args),
    findUnique: (args) => prisma.notification.findUnique(args),
    findMany: () => prisma.notification.findMany()
  });
