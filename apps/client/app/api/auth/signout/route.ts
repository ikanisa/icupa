import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerSupabaseClient } from "@ecotrips/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createRouteHandlerSupabaseClient({ cookies });
  await supabase.auth.signOut();
  const redirectUrl = new URL("/login", request.url);
  return NextResponse.redirect(redirectUrl);
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerSupabaseClient({ cookies });
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
