import type { EntityRepository } from '../../shared/ports.js';
import type { inventoryEntity } from './entities.js';

export type InventoryRepository = EntityRepository<typeof inventoryEntity>;
