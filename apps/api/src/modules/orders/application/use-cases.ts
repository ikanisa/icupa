import { orderEntity } from '../domain/entities.js';
import type { OrderRepository } from '../domain/ports.js';
import { createUseCases } from '../../shared/createUseCases.js';
import type { AuditLogger, RateLimiter } from '../../shared/ports.js';
import type { PaymentProvider } from '../../../infrastructure/providers/types.js';

export const createOrderUseCases = (
  repository: OrderRepository,
  auditLogger: AuditLogger,
  rateLimiter: RateLimiter,
  paymentProvider: PaymentProvider
) => {
  const base = createUseCases(orderEntity, repository, auditLogger, rateLimiter, 'order');

  return {
    ...base,
    async create(input, context) {
      const order = await base.create({ ...input, status: 'pending' }, context);
      await paymentProvider.charge(order.totalCents, order.currency, { orderId: order.id });
      return order;
    }
  };
};
