import { test, expect } from '@playwright/test';

const TABLE_SESSION_RESPONSE = {
  table_session_id: 'sess-1234',
  table_id: 'table-42',
  location_id: 'loc-rw',
  expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};

const LOCATIONS_RESPONSE = [
  {
    id: 'loc-rw',
    tenant_id: 'tenant-1',
    name: 'Kigali Flagship',
    region: 'RW',
    currency: 'RWF',
    timezone: 'Africa/Kigali',
  },
];

const CATEGORIES_RESPONSE = [
  { id: 'cat-starters', name: 'Starters', sort_order: 1 },
];

const ITEMS_RESPONSE = [
  {
    id: 'item-burrata',
    name: 'Burrata',
    description: 'Creamy burrata with roasted tomatoes.',
    price_cents: 1200,
    category_id: 'cat-starters',
    location_id: 'loc-rw',
    allergens: ['dairy'],
    tags: ['vegetarian'],
    is_alcohol: false,
    is_available: true,
  },
];

const PAYMENT_RESPONSE = {
  order_id: 'order-abc123',
  payment_id: 'payment-xyz789',
  payment_status: 'captured',
  payment_method: 'stripe',
  checkout_url: null,
  provider_ref: 'stripe-session-123',
  message: null,
  failure_reason: null,
};

const RECEIPT_RESPONSE = [
  {
    id: 'receipt-1',
    order_id: 'order-abc123',
    fiscal_id: 'RW-EBM-001',
    region: 'RW',
    url: 'https://example.com/receipt.pdf',
    payload: {
      summary: {
        fiscalId: 'RW-EBM-001',
        region: 'RW',
        urls: {
          pdf: 'https://example.com/receipt.pdf',
        },
      },
    },
    created_at: new Date().toISOString(),
  },
];

function json(route: any, body: unknown, status = 200) {
  return route.fulfill({
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test.describe('Client diner journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/functions/v1/create_table_session', async (route) => {
      if (route.request().method() === 'POST') {
        return json(route, TABLE_SESSION_RESPONSE);
      }
      return route.fulfill({ status: 405, body: '' });
    });

    await page.route('**/rest/v1/locations**', async (route) => {
      if (route.request().method() === 'GET') {
        return json(route, LOCATIONS_RESPONSE);
      }
      return route.fulfill({ status: 204, body: '' });
    });

    await page.route('**/rest/v1/categories**', async (route) => {
      if (route.request().method() === 'GET') {
        return json(route, CATEGORIES_RESPONSE);
      }
      return route.fulfill({ status: 204, body: '' });
    });

    await page.route('**/rest/v1/items**', async (route) => {
      if (route.request().method() === 'GET') {
        return json(route, ITEMS_RESPONSE);
      }
      return route.fulfill({ status: 204, body: '' });
    });

    await page.route('**/functions/v1/payments/stripe/checkout', async (route) => {
      if (route.request().method() === 'POST') {
        return json(route, PAYMENT_RESPONSE);
      }
      return route.fulfill({ status: 405, body: '' });
    });

    await page.route('**/rest/v1/receipts**', async (route) => {
      if (route.request().method() === 'GET') {
        return json(route, RECEIPT_RESPONSE);
      }
      return route.fulfill({ status: 204, body: '' });
    });

    await page.route('**/functions/v1/notifications/subscribe_push', async (route) => {
      return json(route, { ok: true });
    });

    // mute auth endpoints (anon session refreshes)
    await page.route('**/auth/v1/**', async (route) => {
      if (route.request().method() === 'POST') {
        return json(route, { access_token: 'anon', refresh_token: 'anon', expires_in: 3600 });
      }
      return json(route, {});
    });
  });

  test('diner links table, orders, pays, and sees receipt', async ({ page }) => {
    await page.goto('/client?qr=fake-token&sig=fake-signature');

    await expect(page.getByText('Burrata')).toBeVisible();

    await page.getByRole('button', { name: /Add to cart/i }).click();

    await page.getByRole('button', { name: /^Cart$/ }).click();
    await expect(page.getByText('Burrata')).toBeVisible();

    await page.getByRole('button', { name: /Proceed to payment/i }).click();
    await expect(page.getByRole('heading', { name: 'Payment method' })).toBeVisible();

    await page.getByRole('button', { name: /^Pay / }).click({ force: true });

    await expect(page.getByText('Payment successful')).toBeVisible();
    await expect(page.getByRole('button', { name: /View receipt/i })).toBeVisible();
  });
});
