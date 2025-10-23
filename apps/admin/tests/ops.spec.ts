import { expect, test } from "@playwright/test";

test.describe("ops console integrations", () => {
  test("renders bookings from ops-bookings", async ({ page }) => {
    await page.route("**/functions/v1/ops-bookings**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ok: true,
          request_id: "req-bookings",
          data: [
            {
              id: "BK-9001",
              traveler: "Test Traveler",
              status: "confirmed",
              total_cents: 186000,
              currency: "USD",
              created_at: "2024-05-05T10:00:00Z",
            },
          ],
        }),
      });
    });

    await page.goto("/bookings");
    await expect(page.getByText("BK-9001")).toBeVisible();
    await expect(page.getByText("Test Traveler")).toBeVisible();
    await expect(page.getByText("Request ID req-bookings")).toBeVisible();
  });

  test("renders exceptions queue via ops-exceptions", async ({ page }) => {
    await page.route("**/functions/v1/ops-exceptions**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ok: true,
          request_id: "req-exceptions",
          data: [
            {
              id: "EX-990",
              type: "stripe-webhook",
              status: "retrying",
              last_error: "RATE_LIMIT",
              occurred_at: "2024-05-05T11:00:00Z",
            },
          ],
        }),
      });
    });

    await page.goto("/exceptions");
    await expect(page.getByText("EX-990")).toBeVisible();
    await expect(page.getByText("stripe-webhook · RATE_LIMIT")).toBeVisible();
    await expect(page.getByText("retrying", { exact: false })).toBeVisible();
  });

  test("submits refunds via ops-refund", async ({ page }) => {
    await page.route("**/functions/v1/ops-refund", async (route) => {
      expect(route.request().method()).toBe("POST");
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: true, request_id: "refund-req" }),
      });
    });

    await page.goto("/finance");
    await page.getByLabel("Itinerary ID").fill("11111111-1111-4111-8111-111111111111");
    await page.getByLabel("Amount").fill("85.50");
    await page.getByLabel("Reason").fill("guest cancellation");
    await page.getByRole("button", { name: "Submit refund" }).click();
    await expect(page.getByText("Refund queued")).toBeVisible();
    await expect(page.getByText("refund-req")).toBeVisible();
  });
});
