import { test, expect } from '@playwright/test';

const SUPABASE_BASE = 'http://127.0.0.1:9999';

function json(route: any, body: unknown, status = 200) {
  return route.fulfill({
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test.describe('Admin QR tooling', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${SUPABASE_BASE}/functions/v1/admin/reissue_table_qr`, async (route) => {
      if (route.request().method() === 'POST') {
        const payload = route.request().postDataJSON?.();
        expect(payload?.body?.table_id).toBe('00000000-0000-4000-8000-000000000501');
        return json(route, {
          table_id: '00000000-0000-4000-8000-000000000501',
          location_id: '00000000-0000-4000-8000-000000000011',
          qr_token: 'signed-token',
          signature: 'signature-hash',
          qr_url: 'https://example.test/qr?signed-token',
          issued_at: '2025-02-01T12:00:00.000Z',
        });
      }
      return json(route, {}, 405);
    });
    await page.route(`${SUPABASE_BASE}/functions/v1/**`, (route) => json(route, { ok: true }));
    await page.route(`${SUPABASE_BASE}/rest/v1/**`, (route) => json(route, []));
  });

  test('rotates a QR payload with deterministic Supabase mocks', async ({ page }) => {
    await page.goto('/admin/tools/qr');

    await page.getByLabel('Table ID').fill('00000000-0000-4000-8000-000000000501');
    await page.getByLabel('Admin token').fill('table-secret');

    await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes('/functions/v1/admin/reissue_table_qr') && response.request().method() === 'POST'
      ),
      page.getByRole('button', { name: /Re-issue QR/i }).click(),
    ]);

    await expect(page.getByText(/QR code rotated/i)).toBeVisible();
    await expect(page.getByText(/signed-token/i)).toBeVisible();
    await expect(page.getByText(/signature-hash/i)).toBeVisible();
    await expect(page.getByText(/https:\/\/example\.test\/qr\?signed-token/)).toBeVisible();
  });
});
