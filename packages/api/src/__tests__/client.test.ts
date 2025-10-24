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

  it("invokes voice domain helpers for initiate and summarize", async () => {
    const initiateResponse = {
      ok: true,
      request_id: "mock-req-1",
      call: { call_id: "mock-call", thread_id: "thread-ops-ank-001", status: "connecting" },
    };
    const summarizeResponse = {
      ok: true,
      request_id: "mock-req-2",
      summary: { call_id: "mock-call", headline: "Summary" },
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(initiateResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(summarizeResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const client = createEcoTripsFunctionClient({ supabaseUrl, anonKey, fetch: fetchMock });

    const initiateInput = {
      thread_id: "thread-ops-ank-001",
      traveler_name: "Anika",
      traveler_phone: "+250 788 123 456",
      locale: "en",
      entry_point: "ops_console",
    } as const;

    const initResult = await client.voice.initiateCall(initiateInput);
    expect(initResult).toEqual(initiateResponse);

    const summarizeInput = {
      thread_id: "thread-ops-ank-001",
      call_id: "mock-call",
      transcript: [
        { speaker: "agent" as const, text: "Hello" },
        { speaker: "traveler" as const, text: "Hi" },
      ],
    } as const;

    const summaryResult = await client.voice.summarizeCall(summarizeInput);
    expect(summaryResult).toEqual(summarizeResponse);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${supabaseUrl}/functions/v1/voice-call-initiate`);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${supabaseUrl}/functions/v1/voice-call-summarize`);
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
