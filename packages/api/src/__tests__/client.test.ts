import { afterEach, describe, expect, it, vi } from "vitest";

import { createEcoTripsFunctionClient } from "../client";
import { InventorySearchInput } from "@ecotrips/types";

const supabaseUrl = "https://example.supabase.co";
const anonKey = "anon-key";

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("EcoTripsFunctionClient", () => {
  it("invokes POST descriptors via domain clients and parses the response", async () => {
    const responsePayload = { ok: true, items: [{ id: "1" }], cacheHit: true };
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(responsePayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const client = createEcoTripsFunctionClient({ supabaseUrl, anonKey, fetch: fetchMock });

    const input = InventorySearchInput.parse({
      destination: "Kigali",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86_400_000).toISOString(),
      party: { adults: 2, children: 0 },
      budgetHint: "balanced",
    });

    const result = await client.inventory.search(input);

    expect(result).toEqual(responsePayload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${supabaseUrl}/functions/v1/inventory-search`);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    });
    expect(init?.body).toBe(JSON.stringify(input));

    const legacy = await client.call("inventory.search", input);
    expect(legacy).toEqual(responsePayload);
  });

  it("serializes query parameters for GET descriptors", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const client = createEcoTripsFunctionClient({ supabaseUrl, anonKey, fetch: fetchMock });

    await client.ops.bookings({ supplier: "gishwati", page: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/functions/v1/ops-bookings?");
    expect(url).toContain("supplier=gishwati");
    expect(url).toContain("page=2");
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
  });

  it("uses user access token and idempotency headers when provided", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const client = createEcoTripsFunctionClient({
      supabaseUrl,
      anonKey,
      fetch: fetchMock,
      getAccessToken: async () => "user-token",
    });

    const payload = {
      itineraryId: crypto.randomUUID(),
      quoteId: "quote",
      amountCents: 1234,
      currency: "USD",
      paymentProvider: "stripe" as const,
      idempotencyKey: "intent-key-123",
    };

    await client.checkout.intent(payload, { idempotencyKey: payload.idempotencyKey });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer user-token",
      "Idempotency-Key": "intent-key-123",
    });
  });

  it("provides concierge domain helpers for edge functions", async () => {
    const responsePayload = {
      ok: true,
      request_id: "req-123",
      source: "fixtures",
      itinerary_id: "itn-1",
      timezone: "Africa/Kigali",
      briefs: [],
    };

    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(responsePayload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const client = createEcoTripsFunctionClient({ supabaseUrl, anonKey, fetch: fetchMock });

    const result = await client.concierge.dailyBrief({ day: 2, limit: 1 });

    expect(result).toEqual(responsePayload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/functions/v1/concierge-daily-brief?");
    expect(url).toContain("day=2");
    expect(url).toContain("limit=1");
    expect(init?.method).toBe("GET");

    fetchMock.mockClear();

    await client.concierge.timeToLeave();
    expect(fetchMock).toHaveBeenCalledWith(
      `${supabaseUrl}/functions/v1/time-to-leave`,
      expect.objectContaining({ method: "GET" }),
    );

    fetchMock.mockClear();

    await client.concierge.safetyAdvisory({ channel: "wallet_modal" });
    expect(fetchMock).toHaveBeenCalledWith(
      `${supabaseUrl}/functions/v1/safety-advisory?channel=wallet_modal`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("aborts long running requests based on the configured timeout", async () => {
    vi.useFakeTimers();

    const abortErrors: unknown[] = [];
    const fetchMock = vi.fn().mockImplementation((_, init: RequestInit = {}) => {
      return new Promise((_, reject) => {
        init.signal?.addEventListener("abort", () => {
          abortErrors.push(init.signal);
          reject(new Error("aborted"));
        });
      });
    });

    const client = createEcoTripsFunctionClient({
      supabaseUrl,
      anonKey,
      fetch: fetchMock,
      defaultTimeoutMs: 5,
    });

    const promise = client.ops.exceptions();
    const assertion = expect(promise).rejects.toThrow("aborted");

    await vi.advanceTimersByTimeAsync(10);
    await assertion;

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.signal?.aborted).toBe(true);
    expect(abortErrors).toHaveLength(1);
  });
});
