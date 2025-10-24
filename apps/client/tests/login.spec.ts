import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("login flow", () => {
  test("renders magic link form and passes accessibility audit", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send magic link" })).toBeEnabled();

    const accessibilityScan = await new AxeBuilder({ page }).analyze();
    const seriousViolations = accessibilityScan.violations.filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical",
    );

    expect(seriousViolations).toEqual([]);
  });
});
