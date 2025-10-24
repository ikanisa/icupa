import { expect, test } from "@playwright/test";
import { POST } from "../app/api/leads/route";

const TEST_ROUTE = "http://localhost/api/leads";

test.describe("lead capture env hardening", () => {
  test("fails fast when Supabase secrets are missing", async () => {
    const hadUrl = Object.prototype.hasOwnProperty.call(process.env, "SUPABASE_URL");
    const hadServiceRole = Object.prototype.hasOwnProperty.call(
      process.env,
      "SUPABASE_SERVICE_ROLE_KEY",
    );
    const originalSupabaseUrl = process.env.SUPABASE_URL;
    const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      const request = new Request(TEST_ROUTE, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Ops Team",
          email: "ops@example.com",
          consent: true,
        }),
      });

      const response = await POST(request);
      const body = (await response.json()) as { ok: boolean; message?: string };

      expect(response.status).toBe(503);
      expect(body.ok).toBe(false);
      expect(body.message ?? "").toContain("configuration");
    } finally {
      if (hadUrl) {
        process.env.SUPABASE_URL = originalSupabaseUrl;
      } else {
        delete process.env.SUPABASE_URL;
      }

      if (hadServiceRole) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
      } else {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      }
    }
  });
});
