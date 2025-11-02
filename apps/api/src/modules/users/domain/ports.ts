import type { EntityRepository } from '../../shared/ports.js';
import type { userEntity } from './entities.js';

export type UserRepository = EntityRepository<typeof userEntity>;
