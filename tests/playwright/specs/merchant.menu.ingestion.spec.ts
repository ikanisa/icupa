import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE_PATH = path.join(process.cwd(), 'tests/playwright/fixtures/sample-menu.pdf');
const LOCATION_ID = '00000000-0000-4000-8000-loc1';
const INGESTION_ID = '00000000-0000-4000-8000-ingest1';
const MENU_ID = '00000000-0000-4000-8000-menu1';

let currentStatus: 'awaiting_review' | 'published' = 'awaiting_review';

const baseIngestion = () => ({
  id: INGESTION_ID,
  tenant_id: '00000000-0000-4000-8000-tenant',
  location_id: LOCATION_ID,
  status: currentStatus,
  original_filename: 'evening-menu.pdf',
  items_count: 2,
  pages_processed: 1,
  updated_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  currency: 'EUR',
  errors: [],
  metadata: {
    location_id: LOCATION_ID,
    confidence_buckets: {
      ge_90: 1,
      ge_75: 1,
      ge_55: 0,
      lt_55: 0,
    },
    page_previews: [{ page: 1, path: 'tenant/ingest/page-001.png' }],
  },
  structured_json: { currency: 'EUR', categories: [] },
  raw_text: 'Starters :: Burrata :: 12.00',
});

function respondJson(route: any, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

test.describe('Merchant menu ingestion pipeline', () => {
  test.beforeEach(async ({ page }) => {
    currentStatus = 'awaiting_review';

    await page.route('**/rest/v1/locations**', async (route) => {
      if (route.request().method() === 'GET') {
        return respondJson(route, [
          {
            id: LOCATION_ID,
            tenant_id: '00000000-0000-4000-8000-tenant',
            name: 'Kigali Flagship',
            region: 'RW',
            currency: 'RWF',
            timezone: 'Africa/Kigali',
          },
        ]);
      }
      return route.fulfill({ status: 204, body: '' });
    });

    await page.route('**/rest/v1/menu_ingestions**', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return respondJson(route, [baseIngestion()]);
      }
      if (method === 'PATCH') {
        return route.fulfill({ status: 204, body: '' });
      }
      return route.fulfill({ status: 204, body: '' });
    });

    await page.route('**/rest/v1/menu_items_staging**', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return respondJson(route, [
          {
            id: 'stage-1',
            ingestion_id: INGESTION_ID,
            category_name: 'Starters',
            name: 'Burrata',
            description: 'Creamy burrata with tomatoes',
            price_cents: 1200,
            currency: 'EUR',
            allergens: ['dairy'],
            tags: ['vegetarian'],
            is_alcohol: false,
            confidence: 0.91,
            flags: {},
          },
          {
            id: 'stage-2',
            ingestion_id: INGESTION_ID,
            category_name: 'Desserts',
            name: 'Tiramisu',
            description: 'Coffee-soaked ladyfingers with mascarpone',
            price_cents: 900,
            currency: 'EUR',
            allergens: ['dairy', 'gluten'],
            tags: ['classic'],
            is_alcohol: false,
            confidence: 0.78,
            flags: {},
          },
        ]);
      }
      return route.fulfill({ status: 204, body: '' });
    });

    await page.route('**/rest/v1/menus**', async (route) => {
      if (route.request().method() === 'GET') {
        return respondJson(route, [
          { id: MENU_ID, name: 'Dinner Menu', version: 3, location_id: LOCATION_ID },
        ]);
      }
      return route.fulfill({ status: 204, body: '' });
    });

    await page.route('**/storage/v1/object/sign/menu_images**', async (route) => {
      if (route.request().method() === 'POST') {
        return respondJson(route, {
          data: {
            signedUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABDQottAAAAABJRU5ErkJggg==',
          },
        });
      }
      return route.fulfill({ status: 204, body: '' });
    });

    await page.route('**/functions/v1/ingest_menu_start', async (route) => {
      if (route.request().method() === 'POST') {
        return respondJson(route, {
          ingestion_id: INGESTION_ID,
          status: 'uploaded',
          storage_path: 'tenant/ingest/menu.pdf',
        });
      }
      return route.fulfill({ status: 405, body: '' });
    });

    await page.route('**/functions/v1/ingest_menu_process', async (route) => {
      if (route.request().method() === 'POST') {
        currentStatus = 'awaiting_review';
        return respondJson(route, {
          ok: true,
          items_count: 2,
          pages_processed: 1,
          errors: [],
        });
      }
      return route.fulfill({ status: 405, body: '' });
    });

    await page.route('**/functions/v1/ingest_menu_publish', async (route) => {
      if (route.request().method() === 'POST') {
        currentStatus = 'published';
        return respondJson(route, {
          published: true,
          items_upserted: 2,
          categories_created: 1,
          version: 4,
          item_ids: ['stage-1', 'stage-2'],
        });
      }
      return route.fulfill({ status: 405, body: '' });
    });
  });

  test('merchant uploads, reviews, and publishes OCR draft', async ({ page }) => {
    await page.goto('/merchant/menu/upload');

    await expect(page.getByText('Upload menu')).toBeVisible();

    await page.getByText('Select location').click();
    await page.getByRole('option', { name: 'Kigali Flagship' }).click();

    await page.setInputFiles('input[type="file"]', FIXTURE_PATH);

    await page.waitForURL('**/merchant/menu/review/**');
    await expect(page.getByRole('heading', { name: 'Draft items' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Burrata' })).toBeVisible();

    await page.getByRole('button', { name: /Publish to menu/i }).click();
    await page.waitForURL('**/merchant/menu');

    await expect(page.getByText('evening-menu.pdf')).toBeVisible();
    await expect(page.getByText(/Published/i)).toBeVisible();
  });
});
