import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const ADMIN_ID = "00000000-0000-4000-8000-0000000000ac";
const ADMIN_EMAIL = "ops.analytics@icupa.test";

async function stubAdminSession(page: Page) {
  await page.route("**/auth/v1/user", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ user: { id: ADMIN_ID, email: ADMIN_EMAIL } }),
      });
      return;
    }
    await route.fulfill({ status: 405, body: "" });
  });

  await page.route("**/rest/v1/user_roles**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        body: JSON.stringify([{ role: "admin" }]),
      });
      return;
    }
    await route.fulfill({ status: 405, body: "" });
  });
}

test.describe("Admin analytics", () => {
  test.beforeEach(async ({ page }) => {
    await stubAdminSession(page);

    await page.route("**/functions/v1/flags.config", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          ok: true,
          request_id: "req-analytics",
          analytics_forwarded: 12,
          flags: [
            {
              key: "ai_waiter",
              description: "AI waiter A/B",
              variants: [
                { name: "control", exposure: 0.55, conversions: 120, uplift: -0.02 },
                { name: "beta", exposure: 0.45, conversions: 170, uplift: 0.18 },
              ],
            },
          ],
        }),
        headers: { "content-type": "application/json" },
      });
    });
  });

  test("displays feature flag analytics with no accessibility violations", async ({ page }) => {
    await page.goto("/admin/performance");

    const accessibilityScan = await new AxeBuilder({ page }).include("main").analyze();
    expect(accessibilityScan.violations).toEqual([]);

    await expect(page.getByText("Feature flag analytics")).toBeVisible();
    await expect(page.getByText("ai_waiter")).toBeVisible();
    await expect(page.getByText("beta")).toBeVisible();
    await expect(page.getByText("18%")).toBeVisible();
    await expect(page.getByText(/Forwarded 12/)).toBeVisible();
    await expect(page.getByText(/Request ID req-analytics/)).toBeVisible();
  });
});
