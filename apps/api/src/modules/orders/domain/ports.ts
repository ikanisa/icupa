import type { EntityRepository } from '../../shared/ports.js';
import type { orderEntity } from './entities.js';

export type OrderRepository = EntityRepository<typeof orderEntity>;
