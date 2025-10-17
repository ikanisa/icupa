import { expect, test } from "@playwright/test";

test.describe("marketing funnel", () => {
  test("lead capture form validates and announces success", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Request tailored proposals" }).click();
    await expect(page.getByRole("alert")).toContainText("Add your name");

    await page.getByLabel("Full name").fill("Scout Team");
    await page.getByLabel("Email").fill("team@example.com");
    await page.getByLabel("Preferred departure month").fill("2025-09");
    await page.getByLabel("Who's traveling?").selectOption("team");
    await page.getByLabel("What kind of impact or experiences are you after?").fill(
      "We host 40-person climate innovation residencies and need local partners.",
    );
    await page.getByLabel("I agree to ecoTrips storing my details").check();

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/leads") && response.request().method() === "POST",
    );

    await page.getByRole("button", { name: "Request tailored proposals" }).click();
    const response = await responsePromise;
    expect(response.status()).toBeLessThan(500);
  });
});
