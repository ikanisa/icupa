import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'ops@icupa.example';

function json(route: any, body: unknown, status = 200) {
  return route.fulfill({
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test.describe('Admin magic link flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/functions/v1/auth/admin_email_magiclink', async (route) => {
      if (route.request().method() === 'POST') {
        return json(route, { ok: true });
      }
      return route.fulfill({ status: 405, body: '' });
    });
  });

  test('admin requests magic link', async ({ page }) => {
    await page.goto('/admin/login');

    await page.getByLabel(/Email address/i).fill(ADMIN_EMAIL);
    await page.getByRole('button', { name: /Send magic link/i }).click();

    await expect(page.getByText('Magic link sent')).toBeVisible();
  });
});
