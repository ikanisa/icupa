import { test, expect } from '@playwright/test';

const SUPABASE_BASE = 'http://127.0.0.1:9999';

const LOCATIONS = [
  {
    id: '00000000-0000-4000-8000-000000000011',
    tenant_id: '00000000-0000-4000-8000-000000000001',
    name: 'Kigali Flagship',
    region: 'RW',
    currency: 'RWF',
    timezone: 'Africa/Kigali',
    settings: { default_locale: 'en-RW', tax_rate_percent: 18 },
  },
  {
    id: '00000000-0000-4000-8000-000000000012',
    tenant_id: '00000000-0000-4000-8000-000000000002',
    name: 'Valletta Waterfront',
    region: 'EU',
    currency: 'EUR',
    timezone: 'Europe/Malta',
    settings: { default_locale: 'en-MT', tax_rate_percent: 18 },
  },
];

const CATEGORIES = [
  {
    id: '00000000-0000-4000-8000-000000000301',
    name: 'Coffee & Tonics',
    sort_order: 1,
  },
  {
    id: '00000000-0000-4000-8000-000000000303',
    name: 'Plates',
    sort_order: 1,
  },
];

const ITEMS = [
  {
    id: '00000000-0000-4000-8000-000000000401',
    name: 'Nyamirambo Chill Brew',
    description: 'Cold brew concentrate with cardamom syrup.',
    price_cents: 3200,
    category_id: '00000000-0000-4000-8000-000000000301',
    location_id: LOCATIONS[0]!.id,
    allergens: ['caffeine'],
    tags: ['drink'],
    is_available: true,
    is_alcohol: false,
  },
  {
    id: '00000000-0000-4000-8000-000000000403',
    name: 'Ftira Valletta',
    description: 'Maltese ftira with capers and olives.',
    price_cents: 1450,
    category_id: '00000000-0000-4000-8000-000000000303',
    location_id: LOCATIONS[1]!.id,
    allergens: ['gluten'],
    tags: ['vegetarian'],
    is_available: true,
    is_alcohol: false,
  },
];

function json(route: any, body: unknown, status = 200) {
  return route.fulfill({
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test.describe('Diner multi-tenant checkout', () => {
  test.beforeEach(async ({ page }) => {
    const session = {
      id: 'session-rw',
      tableId: '00000000-0000-4000-8000-000000000501',
      locationId: LOCATIONS[0]!.id,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    };

    await page.addInitScript((state) => {
      window.localStorage.setItem('icupa_table_session', JSON.stringify(state.session));
      window.localStorage.setItem('icupa_age_gate_choice', 'verified');
      window.localStorage.setItem('icupa_install_banner_dismissed', 'true');
    }, { session });

    await page.route(`${SUPABASE_BASE}/rest/v1/locations**`, (route) => json(route, LOCATIONS));
    await page.route(`${SUPABASE_BASE}/rest/v1/categories**`, (route) => json(route, CATEGORIES));
    await page.route(`${SUPABASE_BASE}/rest/v1/items**`, (route) => json(route, ITEMS));
    await page.route(`${SUPABASE_BASE}/rest/v1/**`, (route) => json(route, []));
    await page.route(`${SUPABASE_BASE}/functions/v1/**`, (route) => json(route, { ok: true }));
  });

  test('diner can swap venues and checkout with tenant-specific payment rails', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Table linked')).toBeVisible();

    await expect(page.getByRole('button', { name: /Kigali Flagship/i })).toBeVisible();
    await expect(page.getByText(/Nyamirambo Chill Brew/i)).toBeVisible();

    await page.getByRole('button', { name: /Add to cart/i }).first().click();
    await page.getByTestId('dock-tab-cart').click();
    await expect(page.getByText(/Nyamirambo Chill Brew/i)).toBeVisible();
    await expect(page.getByText(/FRw/i)).toBeVisible();
    await page.getByRole('button', { name: /Remove Nyamirambo Chill Brew/i }).click();

    await page.getByTestId('dock-tab-menu').click();
    await page.getByRole('button', { name: /Kigali Flagship/i }).click();
    await page.getByRole('option', { name: /Valletta Waterfront/i }).click();

    await expect(page.getByRole('button', { name: /Valletta Waterfront/i })).toBeVisible();
    await expect(page.getByText(/Ftira Valletta/i)).toBeVisible();

    await page.getByRole('button', { name: /Add to cart/i }).first().click();
    await page.getByTestId('dock-tab-cart').click();
    await expect(page.getByText(/Ftira Valletta/i)).toBeVisible();
    await expect(page.getByText(/€14\.50/)).toBeVisible();

    await page.getByTestId('dock-tab-pay').click();
    await expect(page.getByText(/SEPA instant transfer/i)).toBeVisible();
    await expect(page.getByText(/Card & digital wallets/i)).toBeVisible();
  });
});
