import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { promises as fs } from 'fs';

process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'https://example.com/database';
process.env.PORT = process.env.PORT ?? '4001';
process.env.OPENAPI_OUTPUT_PATH = 'spec/openapi.json';

const stubUseCases = {
  list: vi.fn(async () => []),
  getById: vi.fn(async () => ({})),
  create: vi.fn(async () => ({})),
  login: vi.fn(async () => ({ token: 'test' }))
};

vi.mock('../src/modules/index.js', () => ({
  moduleRegistry: {
    auth: stubUseCases,
    users: stubUseCases,
    tenants: stubUseCases,
    listings: stubUseCases,
    inventory: stubUseCases,
    orders: stubUseCases,
    bookings: stubUseCases,
    payments: stubUseCases,
    search: stubUseCases,
    messaging: stubUseCases,
    notifications: stubUseCases,
    files: stubUseCases,
    aiAgents: stubUseCases
  }
}));

import { createUseCases } from '../src/modules/shared/createUseCases.js';
import { userEntity } from '../src/modules/users/domain/entities.js';
import type { AuditLogger, EntityRepository, RateLimiter } from '../src/modules/shared/ports.js';
import { createListingUseCases } from '../src/modules/listings/application/use-cases.js';
import { createOrderUseCases } from '../src/modules/orders/application/use-cases.js';
import { createBookingUseCases } from '../src/modules/bookings/application/use-cases.js';
import { registerRoutes } from '../src/presentation/http/routes.js';

const makeRepository = <Schema extends z.ZodTypeAny>() => {
  const items: Array<z.infer<Schema>> = [];
  const repo: EntityRepository<Schema> = {
    async create(data) {
      items.push(data);
      return data;
    },
    async findById(id) {
      return items.find((item: any) => item.id === id) ?? null;
    },
    async list() {
      return items;
    }
  };
  return { repo, items };
};

const auditLogger: AuditLogger = { record: vi.fn() };
const rateLimiter: RateLimiter = { consume: vi.fn(() => Promise.resolve()) };

describe('shared createUseCases', () => {
  it('validates data and records audit logs', async () => {
    const { repo } = makeRepository<typeof userEntity>();
    const useCases = createUseCases(userEntity, repo, auditLogger, rateLimiter, 'user');

    const created = await useCases.create(
      {
        email: 'user@example.com',
        displayName: 'Test User',
        tenantId: null
      },
      { actorId: 'actor', correlationId: 'corr' }
    );

    expect(created.email).toBe('user@example.com');
    expect(created.id).toBeDefined();
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);
    expect(auditLogger.record).toHaveBeenCalledWith('user.create', expect.any(Object));
    expect(rateLimiter.consume).toHaveBeenCalledWith('actor:user:create');
  });
});

describe('module integrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('indexes listings in the search provider', async () => {
    const { repo } = makeRepository<typeof userEntity>();
    const searchProvider = { indexDocument: vi.fn() };
    const useCases = createListingUseCases(
      repo as any,
      auditLogger,
      rateLimiter,
      searchProvider as any
    );
    await useCases.create(
      {
        tenantId: 'tenant_1',
        title: 'Villa',
        description: 'Beautiful villa with pool',
        priceCents: 10000,
        currency: 'USD'
      } as any,
      { actorId: 'actor', correlationId: 'corr' }
    );

    expect(searchProvider.indexDocument).toHaveBeenCalledWith('listings', expect.objectContaining({ id: expect.any(String) }));
  });

  it('charges payments for orders', async () => {
    const { repo } = makeRepository<typeof userEntity>();
    const paymentProvider = { charge: vi.fn(() => Promise.resolve()) };
    const useCases = createOrderUseCases(
      repo as any,
      auditLogger,
      rateLimiter,
      paymentProvider as any
    );
    await useCases.create(
      {
        userId: 'user',
        tenantId: 'tenant',
        totalCents: 5000,
        currency: 'USD'
      } as any,
      { actorId: 'actor', correlationId: 'corr' }
    );

    expect(paymentProvider.charge).toHaveBeenCalledWith(5000, 'USD', expect.objectContaining({ orderId: expect.any(String) }));
  });

  it('validates booking windows and notifies users', async () => {
    const { repo } = makeRepository<typeof userEntity>();
    const messagingProvider = { sendMessage: vi.fn(() => Promise.resolve()) };
    const useCases = createBookingUseCases(
      repo as any,
      auditLogger,
      rateLimiter,
      messagingProvider as any
    );
    const start = '2024-01-01T00:00:00.000Z';
    const end = '2024-01-02T00:00:00.000Z';
    await useCases.create(
      {
        listingId: 'listing',
        userId: 'user',
        startDate: start,
        endDate: end,
        status: 'pending'
      } as any,
      { actorId: 'actor', correlationId: 'corr' }
    );

    expect(messagingProvider.sendMessage).toHaveBeenCalledWith('user', 'Booking confirmed', expect.objectContaining({ bookingId: expect.any(String) }));

    await expect(
      useCases.create(
        {
          listingId: 'listing',
          userId: 'user',
          startDate: end,
          endDate: start,
          status: 'pending'
        } as any,
        { actorId: 'actor', correlationId: 'corr' }
      )
    ).rejects.toThrow('Invalid booking window');
  });
});

describe('HTTP contract', () => {
  it('returns JSON responses with correlation id', async () => {
    const fakeRegistry = {
      users: {
        list: vi.fn(async () => [{ id: '1' }]),
        getById: vi.fn(async () => ({ id: '1' })),
        create: vi.fn(async () => ({ id: '1' }))
      }
    } as any;

    const handlers: Record<string, (req: any, res: any) => void> = {};
    const app = {
      get: vi.fn((path: string, handler: any) => {
        handlers[`GET ${path}`] = handler;
      }),
      post: vi.fn((path: string, handler: any) => {
        handlers[`POST ${path}`] = handler;
      })
    } as any;

    registerRoutes(app, {
      ...fakeRegistry,
      auth: {
        ...fakeRegistry.users,
        login: vi.fn(async () => ({ token: 'abc' }))
      },
      tenants: fakeRegistry.users,
      listings: fakeRegistry.users,
      inventory: fakeRegistry.users,
      orders: fakeRegistry.users,
      bookings: fakeRegistry.users,
      payments: fakeRegistry.users,
      search: fakeRegistry.users,
      messaging: fakeRegistry.users,
      notifications: fakeRegistry.users,
      files: fakeRegistry.users,
      aiAgents: fakeRegistry.users
    });

    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    await handlers['GET /v1/users']?.(
      { headers: {}, params: {}, query: {} },
      { locals: { correlationId: '1' }, status }
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ data: [{ id: '1' }] });
  });
});

describe('OpenAPI generation', () => {
  it('writes an OpenAPI document', async () => {
    const { generateOpenApi } = await import('../src/presentation/http/openapi.js');
    const document = await generateOpenApi();
    expect(document.openapi).toBe('3.1.0');
    const file = await fs.readFile('spec/openapi.json', 'utf-8');
    expect(JSON.parse(file).info.title).toBe('ICUPA API');
  });
});

describe('GraphQL schema', () => {
  it('generates SDL and resolves query through adapter', async () => {
    const { graphqlSchemaSDL, executeGraphqlQuery } = await import('../src/presentation/graphql/schema.js');
    expect(graphqlSchemaSDL).toContain('type Query');
    const result = await executeGraphqlQuery('{ listings { id } }', 'tester');
    expect(result.data?.listings).toEqual([]);
  });
});
