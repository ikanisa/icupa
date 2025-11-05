import type { PrismaClient } from '@prisma/client';
import { createPrismaEntityRepository } from '../../shared/prisma-entity-repository.js';
import type { ListingRepository } from '../../domain/ports.js';
import { listingEntity } from '../../domain/entities.js';

export const createPrismaListingRepository = (prisma: PrismaClient): ListingRepository =>
  createPrismaEntityRepository<typeof listingEntity>({
    create: (args) => prisma.listing.create(args),
    findUnique: (args) => prisma.listing.findUnique(args),
    findMany: () => prisma.listing.findMany()
  });
