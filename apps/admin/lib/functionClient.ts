import { createEcoTripsFunctionClient } from "@ecotrips/api";
import { createServerSupabaseClient, getSupabaseAccessToken, resolveSupabaseConfig } from "@ecotrips/supabase";
import { cookies } from "next/headers";

type AdminFunctionClient = ReturnType<typeof createEcoTripsFunctionClient> | null;

export async function getOpsFunctionClient(): Promise<AdminFunctionClient> {
  const config = resolveSupabaseConfig();
  if (!config) {
    return null;
  }

  const cookieStore = cookies();
  const supabase = createServerSupabaseClient({ cookies: () => cookieStore }, { config });
  const accessToken = await getSupabaseAccessToken(supabase);

  if (!accessToken) {
    return null;
  }

  return createEcoTripsFunctionClient({
    supabaseUrl: config.supabaseUrl,
    anonKey: config.supabaseKey,
    getAccessToken: async () => accessToken,
    fetch: async (input, init) => {
      return fetch(input, { ...init, cache: "no-store" });
    },
  });
}
