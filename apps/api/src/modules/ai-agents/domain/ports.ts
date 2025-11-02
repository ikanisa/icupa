import type { EntityRepository } from '../../shared/ports.js';
import type { aiAgentEntity } from './entities.js';

export type AiAgentRepository = EntityRepository<typeof aiAgentEntity>;
