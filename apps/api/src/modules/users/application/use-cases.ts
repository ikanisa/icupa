import { createUseCases } from '../../shared/createUseCases.js';
import type { AuditLogger, RateLimiter } from '../../shared/ports.js';
import { userEntity } from '../domain/entities.js';
import type { UserRepository } from '../domain/ports.js';

export const createUserUseCases = (
  repository: UserRepository,
  auditLogger: AuditLogger,
  rateLimiter: RateLimiter
) => createUseCases(userEntity, repository, auditLogger, rateLimiter, 'user');
