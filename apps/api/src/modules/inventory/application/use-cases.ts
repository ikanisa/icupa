import { inventoryEntity } from '../domain/entities.js';
import type { InventoryRepository } from '../domain/ports.js';
import { createUseCases } from '../../shared/createUseCases.js';
import type { AuditLogger, RateLimiter } from '../../shared/ports.js';

export const createInventoryUseCases = (
  repository: InventoryRepository,
  auditLogger: AuditLogger,
  rateLimiter: RateLimiter
) => {
  const base = createUseCases(inventoryEntity, repository, auditLogger, rateLimiter, 'inventory');

  return {
    ...base,
    async create(input, context) {
      if (input.quantity < 0) {
        throw new Error('Quantity cannot be negative');
      }
      return base.create(input, context);
    }
  };
};
