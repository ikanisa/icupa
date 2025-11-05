import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TypedSupabaseClient } from "./types";
import { createBrowserSupabaseClient, createServerSupabaseClient } from "./client";

const createClientMock = vi.fn(() => ({ kind: "supabase-mock" } as unknown as TypedSupabaseClient));
const loadClientEnvMock = vi.fn();
const loadServerEnvMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

vi.mock("@icupa/config/env", () => ({
  loadClientEnv: (...args: unknown[]) => loadClientEnvMock(...args),
  loadServerEnv: (...args: unknown[]) => loadServerEnvMock(...args),
}));

describe("createBrowserSupabaseClient", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    loadClientEnvMock.mockReturnValue({
      NEXT_PUBLIC_SUPABASE_URL: "https://browser.example",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "browser-anon",
      NEXT_PUBLIC_AGENTS_URL: undefined,
    });
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("creates a browser client using public credentials", () => {
    const client = createBrowserSupabaseClient();

    expect(client).toEqual({ kind: "supabase-mock" });
    expect(createClientMock).toHaveBeenCalledWith(
      "https://browser.example",
      "browser-anon",
      expect.objectContaining({
        global: expect.objectContaining({ fetch: undefined }),
      }),
    );
    expect(loadClientEnvMock).toHaveBeenCalledTimes(1);
  });

  it("merges session headers provided by the caller", async () => {
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const client = createBrowserSupabaseClient({
      getHeaders: () => ({ Authorization: "Bearer demo", "X-Trace": "abc" }),
    });

    const config = createClientMock.mock.calls.at(-1)?.[2] as { global?: { fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> } };
    const wrappedFetch = config?.global?.fetch;
    expect(wrappedFetch).toBeTypeOf("function");

    await wrappedFetch?.("https://api.example", {
      headers: { "X-Existing": "true" },
    });

    expect(fetchSpy).toHaveBeenCalledWith("https://api.example", expect.any(Object));
    const [, init] = fetchSpy.mock.calls.at(-1) ?? [];
    const headers = (init as RequestInit | undefined)?.headers as Headers | undefined;
    expect(headers?.get("Authorization")).toBe("Bearer demo");
    expect(headers?.get("X-Trace")).toBe("abc");
    expect(headers?.get("X-Existing")).toBe("true");
    expect(client).toEqual({ kind: "supabase-mock" });
  });
});

describe("createServerSupabaseClient", () => {
  beforeEach(() => {
    loadServerEnvMock.mockReturnValue({
      NEXT_PUBLIC_SUPABASE_URL: "https://server.example",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
      NEXT_PUBLIC_AGENTS_URL: undefined,
      NEXT_PUBLIC_APP_URL: undefined,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates a server client with service role credentials", () => {
    const client = createServerSupabaseClient();

    expect(client).toEqual({ kind: "supabase-mock" });
    expect(createClientMock).toHaveBeenCalledWith(
      "https://server.example",
      "service-role",
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: false, autoRefreshToken: false }),
        global: expect.objectContaining({ fetch: undefined }),
      }),
    );
    expect(loadServerEnvMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to anon key when service role is unavailable", () => {
    loadServerEnvMock.mockReturnValueOnce({
      NEXT_PUBLIC_SUPABASE_URL: "https://server.example",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-only",
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      NEXT_PUBLIC_AGENTS_URL: undefined,
      NEXT_PUBLIC_APP_URL: undefined,
    });

    createServerSupabaseClient();

    expect(createClientMock).toHaveBeenCalledWith(
      "https://server.example",
      "anon-only",
      expect.any(Object),
    );
  });
});
