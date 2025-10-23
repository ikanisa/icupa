import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@ecotrips/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = requestUrl.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createRouteHandlerSupabaseClient({ cookies });
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl));
}
