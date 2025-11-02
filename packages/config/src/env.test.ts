import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadClientEnv, loadServerEnv, parseClientEnv, parseServerEnv } from "./env";

describe("parseClientEnv", () => {
  it("returns validated client configuration", () => {
    const result = parseClientEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      NEXT_PUBLIC_AGENTS_URL: "https://agents.example",
    });

    expect(result).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      NEXT_PUBLIC_AGENTS_URL: "https://agents.example",
    });
  });

  it("throws a readable error when validation fails", () => {
    expect(() =>
      parseClientEnv({
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      }),
    ).toThrowError(/Invalid client environment configuration/);
  });
});

describe("parseServerEnv", () => {
  it("accepts optional values and normalises URLs", () => {
    const result = parseServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      NEXT_PUBLIC_APP_URL: undefined,
      NEXT_PUBLIC_AGENTS_URL: undefined,
      SUPABASE_SERVICE_ROLE_KEY: "service",
    });

    expect(result).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      NEXT_PUBLIC_AGENTS_URL: undefined,
      NEXT_PUBLIC_APP_URL: undefined,
      SUPABASE_SERVICE_ROLE_KEY: "service",
    });
  });

  it("propagates validation errors", () => {
    expect(() =>
      parseServerEnv({
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      }),
    ).toThrowError(/Invalid server environment configuration/);
  });
});

describe("load environment helpers", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("loads client environment variables from process.env", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://client.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "client-anon";
    process.env.NEXT_PUBLIC_AGENTS_URL = "https://agents";

    expect(loadClientEnv()).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://client.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "client-anon",
      NEXT_PUBLIC_AGENTS_URL: "https://agents",
    });
  });

  it("includes optional service role values for server env", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://server.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "server-anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

    expect(loadServerEnv()).toMatchObject({
      NEXT_PUBLIC_SUPABASE_URL: "https://server.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "server-anon",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    });
  });
});
