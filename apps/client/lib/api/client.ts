import { createEcoTripsFunctionClient, EcoTripsFunctionClient } from "@ecotrips/api";

import { getSupabaseConfig } from "./env";

type ClientOverrides = Partial<{
  fetch: typeof fetch;
  getAccessToken: () => Promise<string | null>;
  defaultTimeoutMs: number;
}>;

export function createFunctionClient(overrides: ClientOverrides = {}): EcoTripsFunctionClient | null {
  const config = getSupabaseConfig();
  if (!config) {
    return null;
  }

  return createEcoTripsFunctionClient({
    supabaseUrl: config.supabaseUrl,
    anonKey: config.anonKey,
    fetch: overrides.fetch,
    defaultTimeoutMs: overrides.defaultTimeoutMs,
    getAccessToken: overrides.getAccessToken ?? (async () => null),
  });
}

export function getServerFunctionClient(overrides: ClientOverrides = {}): EcoTripsFunctionClient | null {
  return createFunctionClient(overrides);
}
