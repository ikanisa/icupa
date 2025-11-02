import { listingEntity } from '../domain/entities.js';
import type { ListingRepository } from '../domain/ports.js';
import { createUseCases } from '../../shared/createUseCases.js';
import type { AuditLogger, RateLimiter } from '../../shared/ports.js';
import type { SearchProvider } from '../../../infrastructure/providers/types.js';

export const createListingUseCases = (
  repository: ListingRepository,
  auditLogger: AuditLogger,
  rateLimiter: RateLimiter,
  searchProvider: SearchProvider
) => {
  const base = createUseCases(listingEntity, repository, auditLogger, rateLimiter, 'listing');

  return {
    ...base,
    async create(input, context) {
      const record = await base.create(input, context);
      await searchProvider.indexDocument('listings', {
        id: record.id,
        title: record.title,
        description: record.description,
        tenantId: record.tenantId
      });
      return record;
    }
  };
};
