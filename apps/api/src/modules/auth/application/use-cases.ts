import { authSessionEntity } from '../domain/entities.js';
import type { AuthSessionRepository, Authenticator } from '../domain/ports.js';
import { createUseCases } from '../../shared/createUseCases.js';
import type { AuditLogger, RateLimiter } from '../../shared/ports.js';

export const createAuthUseCases = (
  repository: AuthSessionRepository,
  authenticator: Authenticator,
  auditLogger: AuditLogger,
  rateLimiter: RateLimiter
) => {
  const generic = createUseCases(authSessionEntity, repository, auditLogger, rateLimiter, 'authSession');

  return {
    ...generic,
    async login(identifier: string, secret: string) {
      await rateLimiter.consume(`${identifier}:auth:login`);
      const session = await authenticator.verifyCredentials(identifier, secret);
      auditLogger.record('auth.login', { identifier });
      return repository.create(session);
    }
  };
};
