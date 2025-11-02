import { createApp } from '../src/app.js';
import supertest from 'supertest';

export const smoke = async () => {
  const stub = {
    list: async () => [{ id: 'smoke' }],
    getById: async () => ({ id: 'smoke' }),
    create: async () => ({ id: 'smoke' })
  };

  const app = createApp({
    auth: { ...stub, login: async () => ({ token: 'smoke' }) },
    users: stub,
    tenants: stub,
    listings: stub,
    inventory: stub,
    orders: stub,
    bookings: stub,
    payments: stub,
    search: stub,
    messaging: stub,
    notifications: stub,
    files: stub,
    aiAgents: stub
  } as any);

  const agent = supertest(app);
  const res = await agent.get('/health/live');
  if (res.status !== 200) {
    throw new Error('Health check failed');
  }
  console.log('Smoke test passed');
};

smoke().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
