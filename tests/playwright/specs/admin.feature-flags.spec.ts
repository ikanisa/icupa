import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const ADMIN_ID = "00000000-0000-4000-8000-0000000000ab";
const ADMIN_EMAIL = "ops@icupa.test";

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

test.describe("Admin feature flags", () => {
  test.beforeEach(async ({ page }) => {
    await stubAdminSession(page);

    await page.route("**/rest/v1/ops.console_feature_flags**", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify([
          { key: "ai_waiter", description: "AI waiter rollout", enabled: true },
          { key: "legacy_ui", description: "Legacy UI access", enabled: false },
        ]),
        headers: { "content-type": "application/json" },
      });
    });

    await page.route("**/rest/v1/trust_badges**", async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify([]), headers: { "content-type": "application/json" } });
    });
  });

  test("renders feature flag statuses with accessible markup", async ({ page }) => {
    await page.goto("/admin/settings");

    const accessibilityScan = await new AxeBuilder({ page }).include("main").analyze();
    expect(accessibilityScan.violations).toEqual([]);

    await expect(page.getByText("Feature flags")).toBeVisible();
    await expect(page.getByText("ai_waiter")).toBeVisible();
    await expect(page.getByText("Enabled")).toBeVisible();
    await expect(page.getByText("legacy_ui")).toBeVisible();
    await expect(page.getByText("Disabled")).toBeVisible();
  });
});
