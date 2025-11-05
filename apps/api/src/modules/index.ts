import { prisma } from '../infrastructure/db/prisma-client.js';
import { PinoAuditLogger } from '../infrastructure/observability/logger.js';
import { rateLimiter } from '../infrastructure/providers/rate-limiter.js';
import { paymentProvider } from '../infrastructure/providers/payments.js';
import { searchProvider } from '../infrastructure/providers/search.js';
import { messagingProvider } from '../infrastructure/providers/messaging.js';
import { createAuthUseCases } from './auth/application/use-cases.js';
import { PrismaAuthSessionRepository } from './auth/infrastructure/adapters/prisma-auth-session-repository.js';
import { BasicAuthenticator } from './auth/infrastructure/adapters/basic-authenticator.js';
import { createUserUseCases } from './users/application/use-cases.js';
import { createPrismaUserRepository } from './users/infrastructure/adapters/prisma-user-repository.js';
import { createTenantUseCases } from './tenants/application/use-cases.js';
import { createPrismaTenantRepository } from './tenants/infrastructure/adapters/prisma-tenant-repository.js';
import { createListingUseCases } from './listings/application/use-cases.js';
import { createPrismaListingRepository } from './listings/infrastructure/adapters/prisma-listing-repository.js';
import { createInventoryUseCases } from './inventory/application/use-cases.js';
import { createPrismaInventoryRepository } from './inventory/infrastructure/adapters/prisma-inventory-repository.js';
import { createOrderUseCases } from './orders/application/use-cases.js';
import { createPrismaOrderRepository } from './orders/infrastructure/adapters/prisma-order-repository.js';
import { createBookingUseCases } from './bookings/application/use-cases.js';
import { createPrismaBookingRepository } from './bookings/infrastructure/adapters/prisma-booking-repository.js';
import { createPaymentUseCases } from './payments/application/use-cases.js';
import { createPrismaPaymentRepository } from './payments/infrastructure/adapters/prisma-payment-repository.js';
import { createPrismaSearchRepository } from './search/infrastructure/adapters/prisma-search-repository.js';
import { createMessagingUseCases } from './messaging/application/use-cases.js';
import { createPrismaMessageRepository } from './messaging/infrastructure/adapters/prisma-message-repository.js';
import { createNotificationUseCases } from './notifications/application/use-cases.js';
import { createPrismaNotificationRepository } from './notifications/infrastructure/adapters/prisma-notification-repository.js';
import { createFileUseCases } from './files/application/use-cases.js';
import { createPrismaFileRepository } from './files/infrastructure/adapters/prisma-file-repository.js';
import { createAiAgentUseCases } from './ai-agents/application/use-cases.js';
import { createPrismaAiAgentRepository } from './ai-agents/infrastructure/adapters/prisma-ai-agent-repository.js';
import { createSearchUseCases as createSearchDocumentUseCases } from './search/application/use-cases.js';

const auditLogger = new PinoAuditLogger();

export const moduleRegistry = {
  auth: createAuthUseCases(
    new PrismaAuthSessionRepository(prisma),
    new BasicAuthenticator(prisma),
    auditLogger,
    rateLimiter
  ),
  users: createUserUseCases(createPrismaUserRepository(prisma), auditLogger, rateLimiter),
  tenants: createTenantUseCases(createPrismaTenantRepository(prisma), auditLogger, rateLimiter),
  listings: createListingUseCases(
    createPrismaListingRepository(prisma),
    auditLogger,
    rateLimiter,
    searchProvider
  ),
  inventory: createInventoryUseCases(createPrismaInventoryRepository(prisma), auditLogger, rateLimiter),
  orders: createOrderUseCases(
    createPrismaOrderRepository(prisma),
    auditLogger,
    rateLimiter,
    paymentProvider
  ),
  bookings: createBookingUseCases(
    createPrismaBookingRepository(prisma),
    auditLogger,
    rateLimiter,
    messagingProvider
  ),
  payments: createPaymentUseCases(createPrismaPaymentRepository(prisma), auditLogger, rateLimiter),
  search: createSearchDocumentUseCases(
    createPrismaSearchRepository(prisma),
    auditLogger,
    rateLimiter,
    searchProvider
  ),
  messaging: createMessagingUseCases(
    createPrismaMessageRepository(prisma),
    auditLogger,
    rateLimiter,
    messagingProvider
  ),
  notifications: createNotificationUseCases(
    createPrismaNotificationRepository(prisma),
    auditLogger,
    rateLimiter
  ),
  files: createFileUseCases(createPrismaFileRepository(prisma), auditLogger, rateLimiter),
  aiAgents: createAiAgentUseCases(createPrismaAiAgentRepository(prisma), auditLogger, rateLimiter)
};

export type ModuleRegistry = typeof moduleRegistry;
