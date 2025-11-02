import { aiAgentEntity } from '../domain/entities.js';
import type { AiAgentRepository } from '../domain/ports.js';
import { createUseCases } from '../../shared/createUseCases.js';
import type { AuditLogger, RateLimiter } from '../../shared/ports.js';

const allowedModels = ['gpt-4', 'gpt-4o', 'sonnet', 'llama-3'];

export const createAiAgentUseCases = (
  repository: AiAgentRepository,
  auditLogger: AuditLogger,
  rateLimiter: RateLimiter
) => {
  const base = createUseCases(aiAgentEntity, repository, auditLogger, rateLimiter, 'aiAgent');

  return {
    ...base,
    async create(input, context) {
      if (!allowedModels.includes(input.model)) {
        throw new Error('Model not permitted');
      }
      return base.create(input, context);
    }
  };
};
