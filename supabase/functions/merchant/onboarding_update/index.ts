import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  console.error("Supabase configuration missing for merchant_onboarding_update");
}

const STEP_ORDER = ["start", "verify", "business", "momo", "gps", "menu", "done"] as const;

type Step = (typeof STEP_ORDER)[number];

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message } }, status);
}

function extractBearer(req: Request): string | null {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.*)$/i);
  return match ? match[1]?.trim() ?? null : null;
}

function isValidMomoCode(value?: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return /^[A-Za-z0-9-]{4,32}$/.test(trimmed);
}

function parseGps(input?: unknown) {
  if (!input || typeof input !== "object") return null;
  const { lat, lng, addr } = input as Record<string, unknown>;
  const latitude = typeof lat === "number" ? lat : Number(lat);
  const longitude = typeof lng === "number" ? lng : Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  const record: Record<string, unknown> = { lat: latitude, lng: longitude };
  if (addr && typeof addr === "string") {
    record.addr = addr.slice(0, 256);
  }
  return record;
}

function nextStep(current: Step, requested?: string | null): Step {
  if (!requested) return current;
  const normalized = requested.trim().toLowerCase() as Step;
  if (!STEP_ORDER.includes(normalized)) {
    return current;
  }
  const currentIndex = STEP_ORDER.indexOf(current);
  const requestedIndex = STEP_ORDER.indexOf(normalized);
  if (requestedIndex < currentIndex) {
    return current;
  }
  return normalized;
}

export async function handleMerchantOnboardingUpdate(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST is supported");
  }

  const token = extractBearer(req);
  if (!token) {
    return errorResponse(401, "unauthorized", "Authorization header missing");
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);

  if (authError || !authData?.user) {
    return errorResponse(401, "unauthorized", "Invalid or expired token");
  }

  const userId = authData.user.id;
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const body = (await req.json()) as {
      momo_code?: string;
      gps?: { lat?: number; lng?: number; addr?: string };
      step?: string;
    };

    const { data: profile, error: profileError } = await serviceClient
      .from("merchant_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to load merchant profile", profileError);
      return errorResponse(500, "profile_lookup_failed", "Unable to update profile right now");
    }

    if (!profile) {
      return errorResponse(404, "profile_missing", "Merchant profile not found");
    }

    const updates: Record<string, unknown> = {};

    if (body.momo_code !== undefined) {
      if (!isValidMomoCode(body.momo_code)) {
        return errorResponse(400, "invalid_momo_code", "MoMo code must be 4-32 characters (letters, numbers, hyphen)");
      }
      updates.momo_code = body.momo_code.trim();
    }

    if (body.gps !== undefined) {
      const parsedGps = parseGps(body.gps);
      if (!parsedGps) {
        return errorResponse(400, "invalid_gps", "GPS payload must include numeric lat/lng");
      }
      updates.location_gps = parsedGps;
    }

    const currentStep = (profile.onboarding_step as Step) ?? "start";
    const requestedStep = body.step ?? null;
    const resolvedStep = nextStep(currentStep, requestedStep);
    updates.onboarding_step = resolvedStep;

    const { data: updated, error: updateError } = await serviceClient
      .from("merchant_profiles")
      .update(updates)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (updateError || !updated) {
      console.error("Failed to update merchant profile", updateError);
      return errorResponse(500, "profile_update_failed", "Unable to update profile right now");
    }

    return jsonResponse({ ok: true, profile: updated });
  } catch (error) {
    console.error("Unexpected error in merchant_onboarding_update", error);
    return errorResponse(500, "unexpected_error", "Unexpected error");
  }
}

export default handleMerchantOnboardingUpdate;
