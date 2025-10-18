import { createEcoTripsFunctionClient } from "@ecotrips/api";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

type AdminFunctionClient = ReturnType<typeof createEcoTripsFunctionClient> | null;

export async function getOpsFunctionClient(): Promise<AdminFunctionClient> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return null;
  }

  const cookieStore = cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore }, {
    supabaseUrl,
    supabaseKey: anonKey,
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  const accessToken = session.access_token;

  return createEcoTripsFunctionClient({
    supabaseUrl,
    anonKey,
    getAccessToken: async () => accessToken ?? null,
    fetch: async (input, init) => {
      return fetch(input, { ...init, cache: "no-store" });
    },
  });
}
