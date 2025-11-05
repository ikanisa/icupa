import type { EntityRepository } from '../../shared/ports.js';
import type { searchDocumentEntity } from './entities.js';

export type SearchRepository = EntityRepository<typeof searchDocumentEntity>;
