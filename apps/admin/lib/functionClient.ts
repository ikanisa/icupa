import { createEcoTripsFunctionClient } from "@ecotrips/api";

import { createAdminServerClient } from "./supabaseServer";

type AdminFunctionClient = ReturnType<typeof createEcoTripsFunctionClient> | null;

const bypassAuth = process.env.OPS_CONSOLE_BYPASS_AUTH === "1" && process.env.NODE_ENV !== "production";

export async function getOpsFunctionClient(): Promise<AdminFunctionClient> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? (bypassAuth ? "https://stub.supabase.co" : undefined);
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? (bypassAuth ? "stub-anon-key" : undefined);

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  if (bypassAuth) {
    return createEcoTripsFunctionClient({
      supabaseUrl,
      anonKey,
      getAccessToken: async () => process.env.OPS_CONSOLE_MOCK_ACCESS_TOKEN ?? null,
      fetch: async (input, init) => fetch(input, { ...init, cache: "no-store" }),
    });
  }

  const supabase = await createAdminServerClient();
  if (!supabase) {
    return null;
  }

  if (!accessToken) {
    return null;
  }

  const accessToken = session.access_token ?? process.env.OPS_CONSOLE_MOCK_ACCESS_TOKEN ?? null;

  return createEcoTripsFunctionClient({
    supabaseUrl,
    anonKey,
    getAccessToken: async () => accessToken,
    fetch: async (input, init) => {
      return fetch(input, { ...init, cache: "no-store" });
    },
  });
}
