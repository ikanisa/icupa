import type { EntityRepository } from '../../shared/ports.js';
import type { tenantEntity } from './entities.js';

export type TenantRepository = EntityRepository<typeof tenantEntity>;
