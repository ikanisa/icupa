import type { EntityRepository } from '../../shared/ports.js';
import type { paymentEntity } from './entities.js';

export type PaymentRepository = EntityRepository<typeof paymentEntity>;
