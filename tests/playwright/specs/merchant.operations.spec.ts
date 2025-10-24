import { test, expect } from '@playwright/test';

const SUPABASE_BASE = 'http://127.0.0.1:9999';

const MERCHANT_LOCATIONS = [
  {
    id: '00000000-0000-4000-8000-000000000011',
    tenant_id: '00000000-0000-4000-8000-000000000001',
    name: 'Kigali Flagship',
    region: 'RW',
    currency: 'RWF',
    timezone: 'Africa/Kigali',
  },
  {
    id: '00000000-0000-4000-8000-000000000012',
    tenant_id: '00000000-0000-4000-8000-000000000002',
    name: 'Valletta Waterfront',
    region: 'EU',
    currency: 'EUR',
    timezone: 'Europe/Malta',
  },
];

const KDS_ORDERS = [
  {
    id: 'order-001',
    status: 'submitted',
    created_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    table_id: '00000000-0000-4000-8000-000000000501',
    total_cents: 13400,
    tables: { code: 'T1' },
    order_items: [
      {
        id: 'order-item-001',
        quantity: 2,
        item: { name: 'Nyamirambo Chill Brew', allergens: ['caffeine'] },
      },
    ],
  },
];

const INVENTORY_ITEMS = [
  {
    id: 'inventory-001',
    sku: 'SKU-001',
    display_name: 'Cold Brew Concentrate',
    quantity: 12,
    par_level: 20,
    reorder_threshold: 5,
    auto_86: false,
    auto_86_level: 'L1',
    updated_at: new Date().toISOString(),
    location_id: MERCHANT_LOCATIONS[0]!.id,
  },
];

function json(route: any, body: unknown, status = 200) {
  return route.fulfill({
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test.describe('Merchant multi-tenant dashboards', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${SUPABASE_BASE}/rest/v1/locations**`, (route) => json(route, MERCHANT_LOCATIONS));
    await page.route(`${SUPABASE_BASE}/rest/v1/orders**`, (route) => {
      const url = route.request().url();
      if (url.includes(`location_id=eq.${MERCHANT_LOCATIONS[1]!.id}`)) {
        return json(route, []);
      }
      return json(route, KDS_ORDERS);
    });
    await page.route(`${SUPABASE_BASE}/rest/v1/inventory_items**`, (route) => {
      const url = route.request().url();
      if (url.includes(`location_id=eq.${MERCHANT_LOCATIONS[1]!.id}`)) {
        return json(route, []);
      }
      return json(route, INVENTORY_ITEMS);
    });
    await page.route(`${SUPABASE_BASE}/rest/v1/table_state_events**`, (route) => json(route, []));
    await page.route(`${SUPABASE_BASE}/rest/v1/tables**`, (route) => json(route, []));
    await page.route(`${SUPABASE_BASE}/rest/v1/promo_campaigns**`, (route) => json(route, []));
    await page.route(`${SUPABASE_BASE}/rest/v1/**`, (route) => json(route, []));
    await page.route(`${SUPABASE_BASE}/functions/v1/**`, (route) => json(route, { ok: true }));
  });

  test('merchant advances orders and scopes automation per location', async ({ page }) => {
    await page.goto('/merchant');

    await expect(page.getByRole('heading', { name: 'Kigali Flagship' })).toBeVisible();
    const orderCard = page.getByText(/Table T1/i).first();
    await expect(orderCard).toBeVisible();

    await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes('/rest/v1/orders') && response.request().method() === 'PATCH'
      ),
      page.getByRole('button', { name: /Advance to In Kitchen/i }).click(),
    ]);

    await page.getByRole('button', { name: /Inventory/i }).click();
    await expect(page.getByText(/Cold Brew Concentrate/i)).toBeVisible();

    await page.getByRole('button', { name: /Kigali Flagship/i }).click();
    await page.getByRole('option', { name: /Valletta Waterfront/i }).click();
    await expect(page.getByRole('heading', { name: 'Valletta Waterfront' })).toBeVisible();
    await expect(page.getByText(/No active orders for Valletta Waterfront/i)).toBeVisible();
  });
});
