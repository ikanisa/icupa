import type { PrismaClient } from '@prisma/client';
import { createPrismaEntityRepository } from '../../shared/prisma-entity-repository.js';
import type { BookingRepository } from '../../domain/ports.js';
import { bookingEntity } from '../../domain/entities.js';

export const createPrismaBookingRepository = (prisma: PrismaClient): BookingRepository =>
  createPrismaEntityRepository<typeof bookingEntity>({
    create: (args) => prisma.booking.create(args),
    findUnique: (args) => prisma.booking.findUnique(args),
    findMany: () => prisma.booking.findMany()
  });
