import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("checkout flow", () => {
  test("creates intent placeholder in offline mode", async ({ page }) => {
    await page.goto("/checkout?id=test-itinerary");

    await page.getByLabel("Amount (cents)").fill("250000");
    await page.getByLabel("Currency").fill("USD");
    await page.getByRole("button", { name: "Create payment intent" }).click();

    await expect(page.getByText(/Offline mode/i)).toBeVisible();

    const accessibilityScan = await new AxeBuilder({ page }).analyze();
    const seriousViolations = accessibilityScan.violations.filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical",
    );

    expect(seriousViolations).toEqual([]);
  });
});
