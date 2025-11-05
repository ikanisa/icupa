import { notificationEntity } from '../domain/entities.js';
import type { NotificationRepository } from '../domain/ports.js';
import { createUseCases } from '../../shared/createUseCases.js';
import type { AuditLogger, RateLimiter } from '../../shared/ports.js';

export const createNotificationUseCases = (
  repository: NotificationRepository,
  auditLogger: AuditLogger,
  rateLimiter: RateLimiter
) => createUseCases(notificationEntity, repository, auditLogger, rateLimiter, 'notification');
