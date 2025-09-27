import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const WA_GRAPH_API_BASE = Deno.env.get("WA_GRAPH_API_BASE") ?? "";
const WA_VERIFY_SENDER_ID = Deno.env.get("WA_VERIFY_SENDER_ID") ?? "";
const WA_ACCESS_TOKEN = Deno.env.get("WA_ACCESS_TOKEN") ?? "";

const OTP_TTL_MINUTES = Number(Deno.env.get("WA_OTP_TTL_MIN") ?? "7");
const OTP_WINDOW_MINUTES = Number(Deno.env.get("WA_OTP_WINDOW_MIN") ?? "2");
const OTP_MAX_PER_WINDOW = Number(Deno.env.get("WA_OTP_MAX_PER_WINDOW") ?? "3");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Supabase configuration missing for whatsapp_send_otp");
}

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message } }, status);
}

function sanitizePhone(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!/^\+[1-9][0-9]{6,14}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function generateOtp(): string {
  const number = Math.floor(100000 + Math.random() * 900000);
  return String(number);
}

async function hashValue(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sendWhatsAppMessage(phone: string, body: string): Promise<void> {
  if (!WA_GRAPH_API_BASE || !WA_VERIFY_SENDER_ID || !WA_ACCESS_TOKEN) {
    console.warn(
      "WhatsApp credentials missing; skipping outbound message send.",
      { phone: maskPhone(phone) }
    );
    return;
  }

  try {
    const response = await fetch(
      `${WA_GRAPH_API_BASE.replace(/\/$/, "")}/${WA_VERIFY_SENDER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body },
        }),
      },
    );

    if (!response.ok) {
      console.error("WhatsApp message send failed", {
        status: response.status,
        statusText: response.statusText,
        phone: maskPhone(phone),
      });
    }
  } catch (error) {
    console.error("WhatsApp message send threw", error, { phone: maskPhone(phone) });
  }
}

export async function handleWhatsAppSendOtp(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST is supported");
  }

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const { phone_e164 } = (await req.json()) as { phone_e164?: string };
    const phone = sanitizePhone(phone_e164);

    if (!phone) {
      return errorResponse(400, "invalid_phone", "phone_e164 must be in E.164 format");
    }

    const windowStartIso = new Date(Date.now() - OTP_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count: recentCount, error: rateError } = await client
      .from("whatsapp_otps")
      .select("id", { count: "exact", head: true })
      .eq("phone_e164", phone)
      .gte("created_at", windowStartIso);

    if (rateError) {
      console.error("Rate limit lookup failed", rateError, { phone: maskPhone(phone) });
      return errorResponse(500, "rate_lookup_failed", "Unable to process request");
    }

    if ((recentCount ?? 0) >= OTP_MAX_PER_WINDOW) {
      return errorResponse(429, "rate_limited", "Please wait before requesting another code");
    }

    // Clean up existing codes for this phone to keep only the latest
    await client.from("whatsapp_otps").delete().eq("phone_e164", phone);

    const otp = generateOtp();
    const otpHash = await hashValue(otp);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    const insertResult = await client.from("whatsapp_otps").insert({
      phone_e164: phone,
      otp_hash: otpHash,
      purpose: "login",
      expires_at: expiresAt,
    });

    if (insertResult.error) {
      console.error("Failed to persist OTP", insertResult.error, { phone: maskPhone(phone) });
      return errorResponse(500, "otp_persist_failed", "Unable to generate code right now");
    }

    await sendWhatsAppMessage(
      phone,
      `Your ICUPA code: ${otp} (valid ${OTP_TTL_MINUTES} min). Do not share this code.`,
    );

    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    console.error("Unexpected error in whatsapp_send_otp", error);
    return errorResponse(500, "unexpected_error", "Unexpected error");
  }
}

export default handleWhatsAppSendOtp;
