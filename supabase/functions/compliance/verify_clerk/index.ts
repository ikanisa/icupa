import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
} from "https://deno.land/x/jose@v4.14.4/index.ts";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function error(status: number, code: string, message: string) {
  return json({ error: { code, message } }, status);
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLERK_JWKS_URL = Deno.env.get("CLERK_JWKS_URL") ?? "";
const CLERK_ISSUER = Deno.env.get("CLERK_ISSUER") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase service configuration for verify_clerk");
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
if (CLERK_JWKS_URL) {
  try {
    jwks = createRemoteJWKSet(new URL(CLERK_JWKS_URL));
  } catch (e) {
    console.error("Failed to initialise Clerk JWKS", e);
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return error(405, "method_not_allowed", "Only POST is supported");
  }

  if (!CLERK_JWKS_URL) {
    return error(503, "clerk_not_configured", "CLERK_JWKS_URL is not configured");
  }

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return error(401, "unauthorized", "Bearer token required");
  }
  const token = authHeader.slice(7).trim();
  if (!token) return error(401, "unauthorized", "Bearer token required");

  try {
    const { payload }: { payload: JWTPayload } = await jwtVerify(token, jwks!, {
      issuer: CLERK_ISSUER || undefined,
    });

    const email = (payload.email as string | undefined) || (payload["email_address"] as string | undefined);
    const sub = (payload.sub as string | undefined) ?? null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    let supabaseUserId: string | null = null;
    if (email) {
      try {
        const { data } = await supabase.auth.admin.listUsers();
        const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        supabaseUserId = user?.id ?? null;
      } catch (e) {
        console.error("Failed to list Supabase users for Clerk mapping", e);
      }
    }

    return json({
      ok: true,
      clerk_sub: sub,
      email: email ?? null,
      supabase_user_id: supabaseUserId,
    });
  } catch (e) {
    console.error("Clerk token verification failed", e);
    return error(401, "invalid_token", "Clerk token could not be verified");
  }
});

