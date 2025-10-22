import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const VOICE_AGENT_ENABLED = (Deno.env.get("VOICE_AGENT_ENABLED") ?? "false").toLowerCase() === "true";
const VOICE_REALTIME_API_KEY = Deno.env.get("VOICE_REALTIME_API_KEY") ?? "";
const VOICE_REALTIME_BASE_URL = Deno.env.get("VOICE_REALTIME_BASE_URL") ?? "https://api.openai.com/v1/realtime";
const VOICE_AGENT_MODEL = Deno.env.get("VOICE_AGENT_MODEL") ?? "gpt-4o-realtime-preview";
const TOKEN_TTL_MINUTES = Number(Deno.env.get("VOICE_AGENT_TOKEN_TTL_MINUTES") ?? "10");

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message } }, status);
}

function requireConfig() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase credentials missing for voice session function");
  }
}

function createServiceClient() {
  requireConfig();
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

function createAnonClient(accessToken: string) {
  requireConfig();
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: {
      fetch: (input, init = {}) => {
        const headers = new Headers(init.headers ?? {});
        headers.set("Authorization", `Bearer ${accessToken}`);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

function decodeSession(headers: Headers) {
  const token = headers.get("authorization")?.replace(/bearer/i, "").trim();
  if (!token) {
    return null;
  }
  return token;
}

function generateClientToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function handleVoiceSession(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST is supported");
  }

  if (!VOICE_AGENT_ENABLED) {
    return errorResponse(503, "voice_disabled", "Voice waiter is not enabled in this environment");
  }

  if (!VOICE_REALTIME_API_KEY) {
    return errorResponse(500, "voice_not_configured", "Realtime API key missing");
  }

  const accessToken = decodeSession(req.headers);
  if (!accessToken) {
    return errorResponse(401, "unauthorized", "Authorization header required");
  }

  const anonClient = createAnonClient(accessToken);
  const { data: user, error: userError } = await anonClient.auth.getUser();
  if (userError || !user) {
    return errorResponse(401, "unauthorized", "Unable to validate Supabase session");
  }

  const tableSessionId = readHeader(req, 'x-icupa-session');
  if (!tableSessionId) {
    return errorResponse(400, "missing_table_session", "x-icupa-session header required");
  }

  const serviceClient = createServiceClient();
  const { data: tableSession, error: tableError } = await serviceClient
    .from("table_sessions")
    .select("id, table_id")
    .eq("id", tableSessionId)
    .maybeSingle();

  if (tableError || !tableSession) {
    return errorResponse(404, "session_not_found", "Table session not found or expired");
  }

  const { data: tableRow, error: tableRowError } = await serviceClient
    .from("tables")
    .select("id, location_id")
    .eq("id", tableSession.table_id)
    .maybeSingle();

  if (tableRowError || !tableRow) {
    return errorResponse(404, "table_not_found", "Table metadata not found");
  }

  const { data: locationRow, error: locationError } = await serviceClient
    .from("locations")
    .select("id, tenant_id")
    .eq("id", tableRow.location_id)
    .maybeSingle();

  if (locationError || !locationRow) {
    return errorResponse(404, "location_not_found", "Location metadata not found");
  }

  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
  const clientToken = generateClientToken();

  const { error: insertError } = await serviceClient
    .from("voice_sessions")
    .insert({
      tenant_id: locationRow.tenant_id,
      location_id: locationRow.id,
      table_session_id: tableSessionId,
      client_token: clientToken,
      expires_at: expiresAt,
    });

  if (insertError) {
    console.error("Failed to persist voice session", insertError);
    return errorResponse(500, "voice_session_error", "Unable to create voice session");
  }

  return jsonResponse({
    token: clientToken,
    expires_at: expiresAt,
    realtime_api_key: VOICE_REALTIME_API_KEY,
    realtime_base_url: VOICE_REALTIME_BASE_URL,
    model: VOICE_AGENT_MODEL,
  });
}

export default handleVoiceSession;
