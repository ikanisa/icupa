import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  base64UrlDecode,
  computeSignature,
  sanitizeFingerprint,
  timingSafeEqual,
} from "../_shared/qr.ts";

interface CreateSessionRequest {
  qr_token?: string;
  signature?: string;
  device_fingerprint?: string;
}

interface QrPayload {
  table_id: string;
  location_id?: string | null;
  nonce: string;
  issued_at: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const QR_SIGNING_SECRET = Deno.env.get("TABLE_QR_SIGNING_SECRET") ?? "";
const SESSION_TTL_HOURS = Number(Deno.env.get("TABLE_SESSION_TTL_HOURS") ?? "4");
const TOKEN_MAX_AGE_MINUTES = Number(Deno.env.get("TABLE_QR_MAX_AGE_MINUTES") ?? "15");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase service configuration for create_table_session");
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function errorResponse(status: number, message: string, code: string): Response {
  return jsonResponse({ error: { code, message } }, status);
}

function decodePayload(token: string): QrPayload {
  const decoded = base64UrlDecode(token);
  const text = new TextDecoder().decode(decoded);
  const payload = JSON.parse(text) as QrPayload;
  return payload;
}

function isPayloadValid(payload: QrPayload): boolean {
  if (!payload.table_id || !payload.nonce || !payload.issued_at) {
    return false;
  }
  const issuedAt = new Date(payload.issued_at);
  if (Number.isNaN(issuedAt.getTime())) {
    return false;
  }
  const now = Date.now();
  const issuedTime = issuedAt.getTime();
  const maxAgeMs = TOKEN_MAX_AGE_MINUTES * 60 * 1000;
  if (issuedTime < now - maxAgeMs) {
    return false;
  }
  // allow small clock skew into the future (2 minutes)
  if (issuedTime > now + 2 * 60 * 1000) {
    return false;
  }
  return true;
}

function extractClientIp(headers: Headers): string | null {
  const direct = headers.get("x-forwarded-for") ?? headers.get("cf-connecting-ip");
  if (direct) {
    return direct.split(",")[0]!.trim();
  }
  return null;
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return errorResponse(405, "Only POST requests are supported", "method_not_allowed");
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return errorResponse(415, "Expected application/json payload", "unsupported_media_type");
    }

    const requestBody = (await req.json()) as CreateSessionRequest;
    const qrToken = requestBody.qr_token;
    const signature = requestBody.signature;

    if (!qrToken || !signature) {
      return errorResponse(400, "Missing QR payload or signature", "invalid_request");
    }

    let payload: QrPayload;
    try {
      payload = decodePayload(qrToken);
    } catch (_error) {
      return errorResponse(400, "QR payload could not be decoded", "invalid_payload");
    }

    if (!isPayloadValid(payload)) {
      return errorResponse(400, "QR payload is expired or malformed", "stale_payload");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return errorResponse(500, "Server configuration missing", "config_error");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const tableResult = await supabase
      .from("tables")
      .select("id, location_id, qrtoken")
      .eq("id", payload.table_id)
      .maybeSingle();

    if (tableResult.error) {
      console.error("Failed to load table metadata", tableResult.error);
      return errorResponse(500, "Could not verify table", "table_lookup_failed");
    }

    if (!tableResult.data) {
      return errorResponse(404, "Table not found", "table_missing");
    }

    const qrtoken = tableResult.data.qrtoken ?? "";
    const signingSecret = [qrtoken, QR_SIGNING_SECRET].filter(Boolean).join(".");
    const signaturePayload = `${payload.table_id}.${payload.nonce}.${payload.issued_at}`;
    const expectedSignature = await computeSignature(signingSecret, signaturePayload);

    if (!timingSafeEqual(expectedSignature, signature)) {
      return errorResponse(401, "Signature verification failed", "invalid_signature");
    }

    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
    const fingerprint = sanitizeFingerprint(requestBody.device_fingerprint);
    const clientIp = extractClientIp(req.headers);

    const insertResult = await supabase
      .from("table_sessions")
      .insert({
        table_id: tableResult.data.id,
        device_fingerprint: fingerprint,
        issued_for_ip: clientIp,
        expires_at: expiresAt,
      })
      .select("id, expires_at")
      .single();

    if (insertResult.error) {
      console.error("Failed to persist table session", insertResult.error);
      return errorResponse(500, "Could not create table session", "session_persist_error");
    }

    return jsonResponse({
      table_session_id: insertResult.data.id,
      table_id: tableResult.data.id,
      location_id: tableResult.data.location_id,
      expires_at: insertResult.data.expires_at,
    });
  } catch (error) {
    console.error("Unexpected error in create_table_session", error);
    return errorResponse(500, "Unexpected error", "internal_error");
  }
});
