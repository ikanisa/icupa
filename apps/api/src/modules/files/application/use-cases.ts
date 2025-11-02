import { fileEntity } from '../domain/entities.js';
import type { FileRepository } from '../domain/ports.js';
import { createUseCases } from '../../shared/createUseCases.js';
import type { AuditLogger, RateLimiter } from '../../shared/ports.js';

export const createFileUseCases = (
  repository: FileRepository,
  auditLogger: AuditLogger,
  rateLimiter: RateLimiter
) => {
  const base = createUseCases(fileEntity, repository, auditLogger, rateLimiter, 'file');

  return {
    ...base,
    async create(input, context) {
      if (!input.mimeType.startsWith('image/') && !input.mimeType.startsWith('application/')) {
        throw new Error('Unsupported mime type');
      }
      return base.create(input, context);
    }
  };
};
