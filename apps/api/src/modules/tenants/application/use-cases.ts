import { createUseCases } from '../../shared/createUseCases.js';
import type { AuditLogger, RateLimiter } from '../../shared/ports.js';
import { tenantEntity } from '../domain/entities.js';
import type { TenantRepository } from '../domain/ports.js';

export const createTenantUseCases = (
  repository: TenantRepository,
  auditLogger: AuditLogger,
  rateLimiter: RateLimiter
) => createUseCases(tenantEntity, repository, auditLogger, rateLimiter, 'tenant');
