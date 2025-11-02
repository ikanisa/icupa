import type { EntityRepository } from '../../shared/ports.js';
import type { notificationEntity } from './entities.js';

export type NotificationRepository = EntityRepository<typeof notificationEntity>;
