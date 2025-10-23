import type { Session } from "@supabase/supabase-js";

import type { TypedSupabaseClient } from "./clients";

export async function getSupabaseSession(client: TypedSupabaseClient): Promise<Session | null> {
  const { data, error } = await client.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

export async function requireSupabaseSession(client: TypedSupabaseClient): Promise<Session> {
  const session = await getSupabaseSession(client);
  if (!session) {
    throw new Error("Supabase session required");
  }
  return session;
}

export async function getSupabaseAccessToken(client: TypedSupabaseClient): Promise<string | null> {
  const session = await getSupabaseSession(client);
  return session?.access_token ?? null;
}
