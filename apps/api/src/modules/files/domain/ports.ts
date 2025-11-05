import type { EntityRepository } from '../../shared/ports.js';
import type { fileEntity } from './entities.js';

export type FileRepository = EntityRepository<typeof fileEntity>;
