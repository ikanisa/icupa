import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { base64UrlEncode, computeSignature, encodeJson } from "../../_shared/qr.ts";

interface ReissueRequest {
  table_id?: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const QR_SIGNING_SECRET = Deno.env.get("TABLE_QR_SIGNING_SECRET") ?? "";
const ADMIN_SECRET = Deno.env.get("TABLE_QR_ADMIN_SECRET") ?? "";
const APP_BASE_URL = Deno.env.get("TABLE_QR_APP_BASE_URL") ?? "";

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

function sanitizeBaseUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/$/, "");
}

function authorize(req: Request): boolean {
  if (!ADMIN_SECRET) {
    console.error("TABLE_QR_ADMIN_SECRET is not configured");
    return false;
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  return token === ADMIN_SECRET;
}

function createQrPayload(tableId: string, locationId: string | null): Record<string, unknown> {
  return {
    table_id: tableId,
    location_id: locationId,
    nonce: crypto.randomUUID(),
    issued_at: new Date().toISOString(),
  };
}

export async function handleReissueTableQr(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") {
      return errorResponse(405, "Only POST requests are supported", "method_not_allowed");
    }

    if (!authorize(req)) {
      return errorResponse(401, "Admin token required", "unauthorized");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return errorResponse(500, "Server configuration missing", "config_error");
    }

    const payload = (await req.json()) as ReissueRequest;
    const tableId = payload.table_id;
    if (!tableId) {
      return errorResponse(400, "table_id is required", "invalid_request");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const tableResult = await supabase
      .from("tables")
      .select("id, location_id")
      .eq("id", tableId)
      .maybeSingle();

    if (tableResult.error) {
      console.error("Failed to load table metadata", tableResult.error);
      return errorResponse(500, "Could not load table", "table_lookup_failed");
    }

    if (!tableResult.data) {
      return errorResponse(404, "Table not found", "table_missing");
    }

    const newTokenSecret = crypto.randomUUID().replace(/-/g, "");
    const updateResult = await supabase
      .from("tables")
      .update({ qrtoken: newTokenSecret })
      .eq("id", tableId)
      .select("id, location_id")
      .single();

    if (updateResult.error) {
      console.error("Failed to update table token", updateResult.error);
      return errorResponse(500, "Unable to rotate QR token", "token_rotation_failed");
    }

    const qrPayload = createQrPayload(updateResult.data.id, updateResult.data.location_id);
    const encodedPayload = base64UrlEncode(encodeJson(qrPayload));
    const signingSecret = [newTokenSecret, QR_SIGNING_SECRET].filter(Boolean).join(".");
    const signaturePayload = `${qrPayload.table_id}.${qrPayload.nonce}.${qrPayload.issued_at}`;
    const signature = await computeSignature(signingSecret, signaturePayload);

    const baseUrl = sanitizeBaseUrl(APP_BASE_URL);
    const qrUrl = baseUrl
      ? `${baseUrl}?qr=${encodeURIComponent(encodedPayload)}&sig=${encodeURIComponent(signature)}`
      : null;

    return jsonResponse({
      table_id: updateResult.data.id,
      location_id: updateResult.data.location_id,
      qr_token: encodedPayload,
      signature,
      qr_url: qrUrl,
      issued_at: qrPayload.issued_at,
    });
  } catch (error) {
    console.error("Unexpected error in reissue_table_qr", error);
    return errorResponse(500, "Unexpected error", "internal_error");
  }
}

export default handleReissueTableQr;
