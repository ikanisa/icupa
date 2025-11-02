import { searchDocumentEntity } from '../domain/entities.js';
import type { SearchRepository } from '../domain/ports.js';
import { createUseCases } from '../../shared/createUseCases.js';
import type { AuditLogger, RateLimiter } from '../../shared/ports.js';
import type { SearchProvider } from '../../../infrastructure/providers/types.js';

export const createSearchUseCases = (
  repository: SearchRepository,
  auditLogger: AuditLogger,
  rateLimiter: RateLimiter,
  provider: SearchProvider
) => {
  const base = createUseCases(searchDocumentEntity, repository, auditLogger, rateLimiter, 'search');

  return {
    ...base,
    async create(input, context) {
      const document = await base.create(input, context);
      await provider.indexDocument(document.index, document.payload);
      return document;
    }
  };
};
