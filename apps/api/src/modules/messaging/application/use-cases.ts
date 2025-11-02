import { messageEntity } from '../domain/entities.js';
import type { MessageRepository } from '../domain/ports.js';
import { createUseCases } from '../../shared/createUseCases.js';
import type { AuditLogger, RateLimiter } from '../../shared/ports.js';
import type { MessagingProvider } from '../../../infrastructure/providers/types.js';

export const createMessagingUseCases = (
  repository: MessageRepository,
  auditLogger: AuditLogger,
  rateLimiter: RateLimiter,
  provider: MessagingProvider
) => {
  const base = createUseCases(messageEntity, repository, auditLogger, rateLimiter, 'message');

  return {
    ...base,
    async create(input, context) {
      const message = await base.create(input, context);
      await provider.sendMessage(message.recipient, message.body, { id: message.id });
      return message;
    }
  };
};
