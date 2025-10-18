import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  await supabase.auth.signOut();
  const redirectUrl = new URL("/login", request.url);
  return NextResponse.redirect(redirectUrl);
}

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies });
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
