import type { PrismaClient } from '@prisma/client';
import { createPrismaEntityRepository } from '../../shared/prisma-entity-repository.js';
import type { PaymentRepository } from '../../domain/ports.js';
import { paymentEntity } from '../../domain/entities.js';

export const createPrismaPaymentRepository = (prisma: PrismaClient): PaymentRepository =>
  createPrismaEntityRepository<typeof paymentEntity>({
    create: (args) => prisma.payment.create(args),
    findUnique: (args) => prisma.payment.findUnique(args),
    findMany: () => prisma.payment.findMany()
  });
