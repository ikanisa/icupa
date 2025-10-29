import {
  assert,
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.224.0/testing/asserts.ts";

const WEBHOOK_URL = "https://hooks.local/checkout";
const SUPABASE_URL = "https://example.supabase.co";

function withPatchedFetch(
  stub: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  fn: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = stub as typeof fetch;
  return fn().finally(() => {
    globalThis.fetch = originalFetch;
  });
}

function resetEnv() {
  const keys = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_TIMEOUT_MS",
    "STRIPE_REQUIRE_LIVE",
    "STRIPE_MOCK_MODE",
    "CHECKOUT_DEGRADATION_WEBHOOK_URL",
    "ENVIRONMENT",
    "STAGE",
  ];
  for (const key of keys) {
    try {
      Deno.env.delete(key);
    } catch (_error) {
      // ignore missing env
    }
  }
}

denoTestStrictMode();
denoTestMockMode();

function denoTestStrictMode() {
  Deno.test("strict stripe mode returns degradation failure", async () => {
    resetEnv();
    const fetchCalls: Array<{ url: string; init: RequestInit }> = [];

    await withPatchedFetch(async (input, init = {}) => {
      const url = typeof input === "string" ? input : input.url;
      fetchCalls.push({ url, init });
      if (url.startsWith("https://api.stripe.com")) {
        return new Response("{\"error\":{\"message\":\"Stripe offline\"}}", { status: 500 });
      }
      return new Response("{}", { status: 200 });
    }, async () => {
      Deno.env.set("SUPABASE_URL", SUPABASE_URL);
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key");
      Deno.env.set("STRIPE_SECRET_KEY", "sk_test_123");
      Deno.env.set("STRIPE_REQUIRE_LIVE", "1");
      Deno.env.set("STRIPE_TIMEOUT_MS", "25");
      Deno.env.set("STRIPE_MOCK_MODE", "0");
      Deno.env.set("CHECKOUT_DEGRADATION_WEBHOOK_URL", WEBHOOK_URL);

      const mod = await import("./index.ts?strict");
      const requestId = "req-test-strict";
      const result = await mod.__test__.createPaymentIntent({
        paymentId: "payment-1",
        itineraryId: "00000000-0000-0000-0000-000000000000",
        amountCents: 1200,
        currency: "USD",
        idempotencyKey: "intent-1",
        requestId,
      });

      assertEquals(result.ok, false);
      assertEquals(result.mode, "mock");
      assert(result.fallbackReason?.includes("Stripe mock mode"));

      const webhookCall = fetchCalls.find((call) => call.url === WEBHOOK_URL);
      assert(webhookCall, "expected webhook call when strict mode blocks fallback");
      const body = JSON.parse((webhookCall.init.body as string) ?? "{}");
      assertEquals(body.event, "payments.stripe.degradation");
      assertEquals(body.alert.severity, "critical");
      assertEquals(body.context.fallbackMode, "blocked");
      assertEquals(body.context.requestId, requestId);
      assertMatch(body.message, /Stripe mock mode is disallowed/);
    });

    resetEnv();
  });
}

function denoTestMockMode() {
  Deno.test("mock mode engagement emits warning alert", async () => {
    resetEnv();
    const fetchCalls: Array<{ url: string; init: RequestInit }> = [];

    await withPatchedFetch(async (input, init = {}) => {
      const url = typeof input === "string" ? input : input.url;
      fetchCalls.push({ url, init });
      return new Response("{}", { status: 200 });
    }, async () => {
      Deno.env.set("SUPABASE_URL", SUPABASE_URL);
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key");
      Deno.env.set("STRIPE_SECRET_KEY", "sk_test_456");
      Deno.env.set("STRIPE_MOCK_MODE", "1");
      Deno.env.set("STRIPE_REQUIRE_LIVE", "0");
      Deno.env.set("CHECKOUT_DEGRADATION_WEBHOOK_URL", WEBHOOK_URL);

      const mod = await import("./index.ts?mock");
      const result = await mod.__test__.createPaymentIntent({
        paymentId: "payment-2",
        itineraryId: "00000000-0000-0000-0000-000000000000",
        amountCents: 3400,
        currency: "EUR",
        idempotencyKey: "intent-2",
        requestId: "req-test-mock",
      });

      assertEquals(result.ok, true);
      assertEquals(result.intent.mode, "mock");
      assert(result.fallbackReason?.includes("mock mode engaged"));

      const webhookCall = fetchCalls.find((call) => call.url === WEBHOOK_URL);
      assert(webhookCall, "expected webhook call when mock mode returns intent");
      const body = JSON.parse((webhookCall.init.body as string) ?? "{}");
      assertEquals(body.event, "payments.stripe.degradation");
      assertEquals(body.alert.severity, "warning");
      assertEquals(body.context.fallbackMode, "mock");
    });

    resetEnv();
  });
}
