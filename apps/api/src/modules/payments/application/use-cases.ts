import { paymentEntity } from '../domain/entities.js';
import type { PaymentRepository } from '../domain/ports.js';
import { createUseCases } from '../../shared/createUseCases.js';
import type { AuditLogger, RateLimiter } from '../../shared/ports.js';

export const createPaymentUseCases = (
  repository: PaymentRepository,
  auditLogger: AuditLogger,
  rateLimiter: RateLimiter
) => createUseCases(paymentEntity, repository, auditLogger, rateLimiter, 'payment');
