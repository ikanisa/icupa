import type { EntityRepository } from '../../shared/ports.js';
import type { listingEntity } from './entities.js';

export type ListingRepository = EntityRepository<typeof listingEntity>;
