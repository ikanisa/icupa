import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const OTP_MAX_ATTEMPTS = Number(Deno.env.get("WA_OTP_MAX_ATTEMPTS") ?? "5");
const DEFAULT_MERCHANT_REGION = (Deno.env.get("DEFAULT_MERCHANT_REGION") ?? "RW").toUpperCase();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Supabase configuration missing for whatsapp_verify_otp");
}

type MerchantProfile = {
  user_id: string;
  tenant_id: string;
  role: string;
  whatsapp_number_e164: string | null;
  whatsapp_verified_at: string | null;
  onboarding_step: string;
  momo_code: string | null;
  location_gps: Record<string, unknown> | null;
};

function jsonResponse(payload: Record<string, unknown>, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...(headers ?? {}) },
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

function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}***${phone.slice(-2)}`;
}

async function hashValue(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function regionDefaults(region: string) {
  if (region === "EU") {
    return {
      region: "EU",
      currency: "EUR",
      timezone: "Europe/Malta",
      tenantNamePrefix: "EU Merchant",
      locationName: "Main Floor",
    } as const;
  }
  return {
    region: "RW",
    currency: "RWF",
    timezone: "Africa/Kigali",
    tenantNamePrefix: "RW Merchant",
    locationName: "Main Floor",
  } as const;
}

async function findExistingUserId(admin: ReturnType<typeof createClient>["auth"]["admin"], phone: string, pseudoEmail: string): Promise<string | null> {
  let page = 1;
  const perPage = 200;
  while (page < 10) {
    const response = await admin.listUsers({ page, perPage });
    if (response.error) {
      console.error("listUsers failed", response.error.message);
      return null;
    }
    const match = response.data.users.find((user) => user.phone === phone || user.email === pseudoEmail);
    if (match) {
      return match.id;
    }
    if (!response.data.nextPage) {
      break;
    }
    page = response.data.nextPage;
  }
  return null;
}

async function ensureUser(admin: ReturnType<typeof createClient>["auth"]["admin"], phone: string, pseudoEmail: string) {
  const metadata = {
    login_channel: "whatsapp",
    whatsapp_number_e164: phone,
  };

  const createAttempt = await admin.createUser({
    phone,
    phone_confirm: true,
    email: pseudoEmail,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (createAttempt.data.user) {
    return createAttempt.data.user;
  }

  const existingId = await findExistingUserId(admin, phone, pseudoEmail);
  if (!existingId) {
    throw new Error("Unable to locate existing merchant user after create conflict");
  }

  const { data: user } = await admin.getUserById(existingId);
  if (!user.user) {
    throw new Error("Unable to retrieve existing merchant user");
  }
  if (user.user.user_metadata?.whatsapp_number_e164 !== phone) {
    await admin.updateUserById(existingId, { user_metadata: metadata });
  }
  return user.user;
}

async function ensureMerchantProfile(
  serviceClient: ReturnType<typeof createClient>,
  existingProfile: MerchantProfile | null,
  user: User,
  phone: string,
) {
  const nowIso = new Date().toISOString();
  if (existingProfile) {
    const updateResult = await serviceClient
      .from("merchant_profiles")
      .update({ whatsapp_verified_at: nowIso })
      .eq("user_id", existingProfile.user_id);
    if (updateResult.error) {
      console.error("Failed to update merchant profile", updateResult.error);
    }
    try {
      await serviceClient
        .from("user_roles")
        .insert({ user_id: user.id, tenant_id: existingProfile.tenant_id, role: existingProfile.role ?? "owner" })
        .onConflict("user_id,tenant_id,role")
        .ignore();
    } catch (roleError) {
      console.error("Failed to ensure merchant user role", roleError);
    }
    return { ...existingProfile, whatsapp_verified_at: nowIso };
  }

  const region = DEFAULT_MERCHANT_REGION === "EU" ? "EU" : "RW";
  const defaults = regionDefaults(region);
  const masked = maskPhone(phone);

  const { data: tenantRow, error: tenantError } = await serviceClient
    .from("tenants")
    .insert({ name: `${defaults.tenantNamePrefix} ${masked}`, region: defaults.region })
    .select("id")
    .single();

  if (tenantError || !tenantRow) {
    throw new Error("Failed to create tenant for merchant");
  }

  const { data: locationRow, error: locationError } = await serviceClient
    .from("locations")
    .insert({
      tenant_id: tenantRow.id,
      name: defaults.locationName,
      currency: defaults.currency,
      timezone: defaults.timezone,
      region: defaults.region,
    })
    .select("id")
    .single();

  if (locationError) {
    console.error("Failed to create default location", locationError);
  }

  const { data: profileRow, error: profileError } = await serviceClient
    .from("merchant_profiles")
    .insert({
      user_id: user.id,
      tenant_id: tenantRow.id,
      role: "owner",
      whatsapp_number_e164: phone,
      whatsapp_verified_at: nowIso,
      onboarding_step: "verify",
    })
    .select("*")
    .single();

  if (profileError || !profileRow) {
    throw new Error("Failed to create merchant profile");
  }

  try {
    await serviceClient
      .from("user_roles")
      .insert({ user_id: user.id, tenant_id: tenantRow.id, role: "owner" })
      .onConflict("user_id,tenant_id,role")
      .ignore();
  } catch (roleError) {
    console.error("Failed to upsert merchant user role", roleError);
  }

  return profileRow as MerchantProfile;
}

async function createSession(pseudoEmail: string) {
  if (!SUPABASE_ANON_KEY) {
    return { session: null };
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const linkResponse = await serviceClient.auth.admin.generateLink({
    type: "magiclink",
    email: pseudoEmail,
  });

  if (linkResponse.error || !linkResponse.data?.properties?.email_otp) {
    console.error("Failed to generate session link", linkResponse.error);
    return { session: null };
  }

  const otp = linkResponse.data.properties.email_otp;
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  const verification = await anonClient.auth.verifyOtp({
    email: pseudoEmail,
    token: otp,
    type: "magiclink",
  });

  if (verification.error) {
    console.error("Failed to verify generated magiclink", verification.error);
    return { session: null };
  }

  return { session: verification.data.session };
}

export async function handleWhatsAppVerifyOtp(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST is supported");
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const body = (await req.json()) as { phone_e164?: string; otp?: string };
    const phone = sanitizePhone(body.phone_e164);
    const otp = body.otp?.trim();

    if (!phone || !otp || !/^\d{6}$/.test(otp)) {
      return errorResponse(400, "invalid_request", "phone_e164 and otp are required");
    }

    const otpHash = await hashValue(otp);
    const { data: otpRow, error: lookupError } = await serviceClient
      .from("whatsapp_otps")
      .select("id, otp_hash, expires_at, attempts, created_at")
      .eq("phone_e164", phone)
      .eq("purpose", "login")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error("OTP lookup failed", lookupError, { phone: maskPhone(phone) });
      return errorResponse(500, "otp_lookup_failed", "Unable to verify right now");
    }

    if (!otpRow) {
      return errorResponse(400, "otp_not_found", "Code expired or not found");
    }

    if (otpRow.attempts !== null && otpRow.attempts >= OTP_MAX_ATTEMPTS) {
      await serviceClient.from("whatsapp_otps").delete().eq("id", otpRow.id);
      return errorResponse(429, "too_many_attempts", "Too many invalid attempts. Request a new code.");
    }

    if (new Date(otpRow.expires_at ?? 0).getTime() < Date.now()) {
      await serviceClient.from("whatsapp_otps").delete().eq("id", otpRow.id);
      return errorResponse(400, "otp_expired", "Code expired. Request a new one.");
    }

    if (otpRow.otp_hash !== otpHash) {
      await serviceClient
        .from("whatsapp_otps")
        .update({ attempts: (otpRow.attempts ?? 0) + 1 })
        .eq("id", otpRow.id);
      return errorResponse(401, "invalid_code", "Invalid code provided");
    }

    await serviceClient.from("whatsapp_otps").delete().eq("phone_e164", phone);

    const pseudoEmail = `${phone.replace(/[^0-9]/g, "")}@merchant.icupa`;
    const admin = serviceClient.auth.admin;

    const { data: existingProfileData } = await serviceClient
      .from("merchant_profiles")
      .select("user_id, tenant_id, role, whatsapp_number_e164, whatsapp_verified_at, onboarding_step, momo_code, location_gps")
      .eq("whatsapp_number_e164", phone)
      .maybeSingle();

    const merchantUser = existingProfileData
      ? await admin.getUserById(existingProfileData.user_id)
      : { data: { user: null } };

    let targetUser: User | null = merchantUser.data?.user ?? null;

    if (!targetUser) {
      targetUser = await ensureUser(admin, phone, pseudoEmail);
    }

    const profile = await ensureMerchantProfile(
      serviceClient,
      existingProfileData as MerchantProfile | null,
      targetUser,
      phone,
    );

    const { session } = await createSession(pseudoEmail);

    const headers = new Headers();
    if (session) {
      const cookieFlags = "Path=/; HttpOnly; Secure; SameSite=None";
      headers.append(
        "Set-Cookie",
        `sb-access-token=${session.access_token}; Max-Age=${session.expires_in}; ${cookieFlags}`,
      );
      headers.append(
        "Set-Cookie",
        `sb-refresh-token=${session.refresh_token}; Max-Age=${60 * 60 * 24 * 90}; ${cookieFlags}`,
      );
    }

    return jsonResponse(
      {
        ok: true,
        session: session
          ? {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              expires_in: session.expires_in,
            }
          : null,
        merchant_profile: profile,
      },
      200,
      headers,
    );
  } catch (error) {
    console.error("Unexpected error in whatsapp_verify_otp", error);
    return errorResponse(500, "unexpected_error", "Unexpected error");
  }
}

export default handleWhatsAppVerifyOtp;
