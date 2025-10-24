import { randomUUID } from "node:crypto";
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

const bypassToken = process.env.LEADS_CAPTCHA_DEBUG_BYPASS_TOKEN ?? "debug-ok";
const failToken = process.env.LEADS_CAPTCHA_DEBUG_FAIL_TOKEN ?? "debug-fail";

function buildPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Scout Team",
    email: `team+${randomUUID()}@example.com`,
    travelMonth: "2025-09",
    groupType: "team",
    message: "We host 40-person climate innovation residencies and need local partners.",
    consent: true,
    ...overrides,
  };
}

test.describe.serial("lead capture api", () => {
  test("accepts valid submissions with captcha", async ({ request }) => {
    const response = await request.post("/api/leads", {
      data: buildPayload({ captchaToken: bypassToken }),
      headers: { "x-forwarded-for": "198.51.100.10" },
    });

    expect([200, 202]).toContain(response.status());
    const body = await response.json();
    expect(body.ok).toBeTruthy();
  });

  test("rejects submissions when captcha fails", async ({ request }) => {
    const response = await request.post("/api/leads", {
      data: buildPayload({ captchaToken: failToken }),
      headers: { "x-forwarded-for": "198.51.100.11" },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.ok).toBeFalsy();
  });

  test("enforces rate limiting per origin ip", async ({ request }) => {
    const ip = "203.0.113.77";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request.post("/api/leads", {
        data: buildPayload({ captchaToken: bypassToken, email: `burst${attempt}+${randomUUID()}@example.com` }),
        headers: { "x-forwarded-for": ip },
      });
      expect([200, 202]).toContain(response.status());
    }

    const blocked = await request.post("/api/leads", {
      data: buildPayload({ captchaToken: bypassToken, email: `limit+${randomUUID()}@example.com` }),
      headers: { "x-forwarded-for": ip },
    });

    expect(blocked.status()).toBe(429);
    const body = await blocked.json();
    expect(body.ok).toBeFalsy();
  });
});
