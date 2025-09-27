import { test, expect } from '@playwright/test';

const PHONE = '+250788000000';
const SESSION_RESPONSE = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
};

function json(route: any, body: unknown, status = 200) {
  return route.fulfill({
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test.describe('Merchant WhatsApp login', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/functions/v1/auth/whatsapp_send_otp', async (route) => {
      if (route.request().method() === 'POST') {
        return json(route, { ok: true });
      }
      return route.fulfill({ status: 405, body: '' });
    });

    await page.route('**/functions/v1/auth/whatsapp_verify_otp', async (route) => {
      if (route.request().method() === 'POST') {
        return json(route, {
          ok: true,
          session: SESSION_RESPONSE,
          merchant_profile: {
            user_id: 'user-1',
            tenant_id: 'tenant-1',
            onboarding_step: 'verify',
          },
        });
      }
      return route.fulfill({ status: 405, body: '' });
    });

    await page.route('**/auth/v1/token**', async (route) => {
      if (route.request().method() === 'POST') {
        return json(route, SESSION_RESPONSE);
      }
      return json(route, {});
    });

    await page.route('**/rest/v1/merchant_profiles**', async (route) => {
      if (route.request().method() === 'GET') {
        return json(route, [{
          user_id: 'user-1',
          tenant_id: 'tenant-1',
          role: 'owner',
          whatsapp_number_e164: PHONE,
          whatsapp_verified_at: new Date().toISOString(),
          onboarding_step: 'verify',
          momo_code: null,
          location_gps: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);
      }
      return route.fulfill({ status: 204, body: '' });
    });

    await page.route('**/rest/v1/locations**', async (route) => {
      if (route.request().method() === 'GET') {
        return json(route, [
          {
            id: 'loc-1',
            tenant_id: 'tenant-1',
            name: 'Flagship',
            region: 'RW',
            currency: 'RWF',
            timezone: 'Africa/Kigali',
          },
        ]);
      }
      return route.fulfill({ status: 204, body: '' });
    });
  });

  test('merchant completes OTP login', async ({ page }) => {
    await page.goto('/merchant/login');

    await page.getByLabel(/WhatsApp number/i).fill(PHONE);
    await page.getByRole('button', { name: /send otp/i }).click();
    await expect(page.getByText('Code sent')).toBeVisible();

    await page.getByLabel(/6-digit code/i).fill('123456');
    await page.getByRole('button', { name: /verify/i }).click();

    await expect(page).toHaveURL(/\/merchant$/);
    await expect(page.getByText('Merchant portal')).toBeVisible();
  });
});
