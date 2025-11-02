import type { EntityRepository } from '../../shared/ports.js';
import type { messageEntity } from './entities.js';

export type MessageRepository = EntityRepository<typeof messageEntity>;
