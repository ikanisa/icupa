import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import type { AdminDatabase } from "./databaseTypes";

type AdminServerClient = ReturnType<typeof createServerComponentClient<AdminDatabase>>;

export async function createAdminServerClient(): Promise<AdminServerClient | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const cookieStore = cookies();
  return createServerComponentClient<AdminDatabase>({ cookies: () => cookieStore }, {
    supabaseUrl,
    supabaseKey,
  });
}
