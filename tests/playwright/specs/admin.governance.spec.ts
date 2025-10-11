import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

type StaffMember = {
  userId: string;
  role: string;
  email: string | null;
  displayName: string | null;
  grantedAt: string | null;
  grantedBy: string | null;
  whatsappNumber: string | null;
  whatsappVerifiedAt: string | null;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
};

const ADMIN_ID = '00000000-0000-4000-8000-0000000000aa';
const ADMIN_EMAIL = 'ops@icupa.test';
const TENANT_ID = '00000000-0000-4000-8000-000000000001';

function json(route: any, body: unknown, status = 200) {
  return route.fulfill({
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test.describe('Admin governance – staff access', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Supabase auth user
    await page.route('**/auth/v1/user', async (route) => {
      if (route.request().method() === 'GET') {
        return json(route, { user: { id: ADMIN_ID, email: ADMIN_EMAIL } });
      }
      return route.fulfill({ status: 405, body: '' });
    });

    // Admin role check
    await page.route('**/rest/v1/user_roles**', async (route) => {
      const url = route.request().url();
      if (url.includes('select=role') && route.request().method() === 'GET') {
        return json(route, [{ role: 'admin' }]);
      }
      return route.continue();
    });

    // Tenant listing
    await page.route('**/rest/v1/tenants**', async (route) => {
      if (route.request().method() === 'GET') {
        return json(route, [
          {
            id: TENANT_ID,
            name: 'Demo Tenant',
            region: 'RW',
            settings: { currency: 'RWF' },
          },
        ]);
      }
      return route.continue();
    });

    const staffMembers: StaffMember[] = [
      {
        userId: ADMIN_ID,
        role: 'admin',
        email: ADMIN_EMAIL,
        displayName: 'Ops Admin',
        grantedAt: '2025-01-01T10:00:00Z',
        grantedBy: null,
        whatsappNumber: '+250788123456',
        whatsappVerifiedAt: '2025-01-01T10:02:00Z',
        emailConfirmedAt: '2025-01-01T10:00:00Z',
        lastSignInAt: '2025-01-05T09:15:00Z',
      },
    ];

    await page.route('**/functions/v1/admin/user_roles', async (route) => {
      const request = route.request();
      const body = (request.postDataJSON?.() ?? {}) as Record<string, unknown>;
      const action = body.action as string | undefined;

      if (request.method() !== 'POST' || !action) {
        return route.fulfill({ status: 405, body: '' });
      }

      if (action === 'list') {
        return json(route, { members: staffMembers });
      }

      if (action === 'add') {
        const email = String(body.email ?? '').toLowerCase();
        const role = String(body.role ?? '').toLowerCase();
        const newId = randomUUID();
        staffMembers.push({
          userId: newId,
          role,
          email,
          displayName: email,
          grantedAt: new Date().toISOString(),
          grantedBy: ADMIN_ID,
          whatsappNumber: null,
          whatsappVerifiedAt: null,
          emailConfirmedAt: null,
          lastSignInAt: null,
        });
        return json(route, {
          status: 'assigned',
          invited: true,
          userId: newId,
          tenantId: TENANT_ID,
          role,
        });
      }

      if (action === 'remove') {
        const targetId = (body.userId as string | undefined) ?? null;
        if (!targetId) {
          return json(route, { status: 'noop', message: 'User already absent' });
        }
        const index = staffMembers.findIndex((member) => member.userId === targetId);
        if (index >= 0) {
          const [removed] = staffMembers.splice(index, 1);
          return json(route, {
            status: 'revoked',
            userId: targetId,
            removedRoles: [removed.role],
          });
        }
        return json(route, { status: 'noop', message: 'Role not found for user' });
      }

      return json(route, { error: 'Unsupported action' }, 400);
    });
  });

  test('invites and removes staff members', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.getByText('Tenant staff roster')).toBeVisible();
    await expect(page.getByText(/ops@icupa\.test/i)).toBeVisible();
    await expect(page.getByText(/Role:\s+ADMIN/i)).toBeVisible();

    await page.getByLabel(/Staff email/i).fill('chef@demo.test');
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Chef' }).click();

    await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes('/functions/v1/admin/user_roles') &&
        response.request().postData()?.includes('"action":"add"')
      ),
      page.getByRole('button', { name: /Invite staff/i }).click(),
    ]);

    await expect(page.getByText('Invite sent')).toBeVisible();
    await expect(page.getByText(/chef@demo.test/i)).toBeVisible();
    await expect(page.getByText(/Role:\s+CHEF/i)).toBeVisible();

    const newMemberRow = page.locator('li').filter({ hasText: /chef@demo.test/i });
    await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes('/functions/v1/admin/user_roles') &&
        response.request().postData()?.includes('"action":"remove"')
      ),
      newMemberRow.getByRole('button', { name: /Remove/i }).click(),
    ]);

    await expect(page.getByText('Access revoked')).toBeVisible();
    await expect(page.getByText(/chef@demo.test/i)).toHaveCount(0);
  });
});
