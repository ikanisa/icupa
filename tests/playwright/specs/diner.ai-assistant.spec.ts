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
    locale: 'en',
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

const AGENT_RESPONSE = {
  session_id: '00000000-0000-0000-0000-000000000001',
  reply: 'You might enjoy the Burrata starter paired with a sparkling water.',
  upsell: [
    {
      item_id: 'item-burrata',
      name: 'Burrata',
      price_cents: 1200,
      currency: 'RWF',
      rationale: 'Fresh and creamy with seasonal tomatoes.',
      allergens: ['dairy'],
      tags: ['vegetarian'],
      is_alcohol: false,
      citations: ['menu:item-burrata'],
    },
  ],
  disclaimers: ['Please confirm any severe allergies with staff.'],
  citations: ['menu:item-burrata'],
  cost_usd: 0.0042,
  metadata: {
    runs: [
      {
        agent_type: 'waiter',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 120, outputTokens: 210 },
        cost_usd: 0.0042,
        tool_traces: [
          {
            trace_id: 'trace-1',
            agent_type: 'waiter',
            tool: 'get_menu',
            status: 'succeeded',
            input: { limit: 20 },
            output: { items: [] },
          },
        ],
        suggested_prompts: [
          {
            id: 'prompt-1',
            agent_type: 'waiter',
            prompt: 'Review my current order',
            source: 'fallback',
          },
        ],
      },
    ],
    suggested_prompts: [
      {
        id: 'prompt-2',
        agent_type: 'waiter',
        prompt: 'Filter items to avoid my allergens',
        source: 'fallback',
      },
    ],
  },
};

function json(route: any, body: unknown, status = 200) {
  return route.fulfill({
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test.describe('Diner AI assistant', () => {
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

    // mute auth endpoints (anon session refreshes)
    await page.route('**/auth/v1/**', async (route) => {
      if (route.request().method() === 'POST') {
        return json(route, { access_token: 'anon', refresh_token: 'anon', expires_in: 3600 });
      }
      return json(route, {});
    });
  });

  test('renders suggestions, sends message, records feedback', async ({ page }) => {
    let feedbackPayload: any = null;

    await page.route('**/agents/waiter', async (route) => {
      if (route.request().method() === 'POST') {
        return json(route, AGENT_RESPONSE);
      }
      return route.fulfill({ status: 405, body: '' });
    });

    await page.route('**/agent-feedback', async (route) => {
      feedbackPayload = await route.request().postDataJSON();
      return route.fulfill({ status: 204, body: '' });
    });

    await page.goto('/client?qr=fake-token&sig=fake-signature');

    await page.getByTestId('dock-tab-icupa').click();

    const firstQuickReply = page.getByTestId('agent-quick-reply').first();
    await expect(firstQuickReply).toBeVisible();

    const quickText = (await firstQuickReply.textContent())?.trim() ?? '';
    await firstQuickReply.click();

    await page.getByTestId('agent-chat-send').click();

    await expect(
      page
        .getByTestId('agent-message-assistant')
        .filter({ hasText: AGENT_RESPONSE.reply })
    ).toBeVisible();

    const addButton = page.getByTestId('agent-upsell-add');
    await expect(addButton).toBeVisible();
    await addButton.click();
    await expect(page.getByText(`${AGENT_RESPONSE.upsell[0].name} added to cart`)).toBeVisible();

    await page.getByTestId('agent-feedback-up').click();

    await expect.poll(() => feedbackPayload?.rating ?? null).toBe('up');
    await expect(feedbackPayload).toMatchObject({
      session_id: AGENT_RESPONSE.session_id,
      agent_type: 'waiter',
    });

    // quick replies merge fallbacks with agent prompts
    await expect(page.getByTestId('agent-quick-reply').first()).toHaveText(quickText);
  });
});
