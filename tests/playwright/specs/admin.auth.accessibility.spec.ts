import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test.describe("Admin authentication", () => {
  test("magic link flow is accessible and returns confirmation", async ({ page }) => {
    await page.route("**/auth/v1/magiclink", async (route) => {
      expect(route.request().method()).toBe("POST");
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });

    await page.goto("/admin/login");

    const accessibilityScan = await new AxeBuilder({ page }).include("main").analyze();
    expect(accessibilityScan.violations).toEqual([]);

    await page.getByLabel(/Ops email/i).fill("ops@icupa.test");
    await page.getByRole("button", { name: /Send magic link/i }).click();

    await expect(page.getByText(/Magic link sent/i)).toBeVisible();
  });
});
