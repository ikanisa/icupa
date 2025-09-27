import { test, expect, request as pwRequest } from '@playwright/test';

const BASE = process.env.AGENTS_BASE_URL?.replace(/\/$/, '');
const TENANT_ID = process.env.AGENTS_TENANT_ID;
const LOCATION_ID = process.env.AGENTS_LOCATION_ID;

test.describe('Agents service smoke', () => {
  test.skip(!BASE, 'AGENTS_BASE_URL not set');

  test('health endpoint', async () => {
    const request = await pwRequest.newContext();
    const res = await request.get(`${BASE}/health`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ok');
  });

  test('waiter basic prompt (requires tenant/location)', async () => {
    test.skip(!TENANT_ID || !LOCATION_ID, 'AGENTS_TENANT_ID/AGENTS_LOCATION_ID not set');
    const request = await pwRequest.newContext();
    const res = await request.post(`${BASE}/agents/waiter`, {
      data: {
        message: 'Hello! What is popular?',
        tenant_id: TENANT_ID,
        location_id: LOCATION_ID,
        language: 'en',
      },
      timeout: 60_000,
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(typeof json.session_id).toBe('string');
    expect(typeof json.reply).toBe('string');
  });
});

