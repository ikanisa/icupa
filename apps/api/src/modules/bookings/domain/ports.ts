import type { EntityRepository } from '../../shared/ports.js';
import type { bookingEntity } from './entities.js';

export type BookingRepository = EntityRepository<typeof bookingEntity>;
