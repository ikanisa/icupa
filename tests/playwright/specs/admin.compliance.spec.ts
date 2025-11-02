import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const ADMIN_ID = "00000000-0000-4000-8000-0000000000ad";
const ADMIN_EMAIL = "ops.compliance@icupa.test";

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

test.describe("Admin compliance", () => {
  test.beforeEach(async ({ page }) => {
    await stubAdminSession(page);
  });

  test("renders privacy operations workflows accessibly", async ({ page }) => {
    await page.goto("/admin/privacy");

    const accessibilityScan = await new AxeBuilder({ page }).include("main").analyze();
    expect(accessibilityScan.violations).toEqual([]);

    await expect(page.getByText(/Privacy operations/i)).toBeVisible();
    await expect(page.getByLabel(/Subject user ID/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Submit request/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Review request/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Queue export/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Plan erasure/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Execute erasure/i })).toBeVisible();
  });
});
