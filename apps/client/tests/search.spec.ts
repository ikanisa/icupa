import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("search flow", () => {
  test("submits form and shows results page", async ({ page }) => {
    await page.goto("/search");

    await page.getByLabel("Destination").fill("Nyungwe");
    await page.getByLabel("Start date").fill("2025-01-01");
    await page.getByLabel("End date").fill("2025-01-04");
    await page.getByLabel("Adults").fill("2");
    await page.getByRole("button", { name: "Search inventory" }).click();

    await expect(page).toHaveURL(/\/results/);
    await expect(page.getByRole("heading", { name: /Top picks/ })).toBeVisible();

    const accessibilityScan = await new AxeBuilder({ page }).analyze();
    const seriousViolations = accessibilityScan.violations.filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical",
    );

    expect(seriousViolations).toEqual([]);
  });
});
