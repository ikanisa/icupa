import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { buildGetHeaders, buildGrowthHeaders, resolveGrowthConfig } from "../_shared/growth.ts";

const REFERRAL_BASE_URL = Deno.env.get("REFERRAL_BASE_URL") ?? "https://go.ecotrips.earth/r";

interface ReferralRequestBody {
  inviter_user_id?: unknown;
  invitee_email?: unknown;
  invitee_user_id?: unknown;
  channel?: unknown;
  consent?: unknown;
  idempotency_key?: unknown;
  referral_code?: unknown;
}

interface InvitationRecord {
  id: string;
  referral_code: string;
  status: string;
  consent_captured: boolean;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("referral-link");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  let body: ReferralRequestBody;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const inviterUserId = typeof body.inviter_user_id === "string" ? body.inviter_user_id : "";
  const inviteeEmail = typeof body.invitee_email === "string" ? body.invitee_email.trim().toLowerCase() : "";
  const inviteeUserId = typeof body.invitee_user_id === "string" ? body.invitee_user_id : undefined;
  const consent = body.consent === true;
  const idempotencyKey = typeof body.idempotency_key === "string" && body.idempotency_key.length > 0
    ? body.idempotency_key
    : undefined;
  const channelValue = normalizeChannel(body.channel);

  const errors: string[] = [];
  if (!inviterUserId) errors.push("inviter_user_id required");
  if (!inviteeEmail || !inviteeEmail.includes("@")) errors.push("invitee_email must be valid");
  if (!consent) errors.push("consent required");

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const referralCode = typeof body.referral_code === "string" && body.referral_code.length >= 4
    ? body.referral_code
    : generateReferralCode(inviterUserId, inviteeEmail);

  const growthConfig = resolveGrowthConfig({ offlineFlag: "GROWTH_REFERRAL_OFFLINE" });

  if (growthConfig.offline) {
    logOfflineFallback({ requestId, reason: growthConfig.reason ?? "offline" });
    return jsonResponse({
      ok: true,
      request_id: requestId,
      mode: "offline",
      referral_code: referralCode,
      link: buildReferralLink(referralCode),
      status: "pending",
    });
  }

  const existing = await findExistingInvitation({
    config: growthConfig,
    inviterUserId,
    inviteeEmail,
    idempotencyKey,
  });
  if (existing) {
    return jsonResponse({
      ok: true,
      request_id: requestId,
      reused: true,
      invitation_id: existing.id,
      referral_code: existing.referral_code,
      status: existing.status,
      link: buildReferralLink(existing.referral_code),
    });
  }

  const payload = {
    inviter_user_id: inviterUserId,
    invitee_email: inviteeEmail,
    invitee_user_id: inviteeUserId ?? null,
    referral_code: referralCode,
    status: "pending",
    idempotency_key: idempotencyKey ?? crypto.randomUUID(),
    sent_via: channelValue,
    consent_captured: true,
    metadata: {
      channel: channelValue,
      request_id: requestId,
    },
  };

  const response = await fetch(`${growthConfig.url}/rest/v1/referral_invitations`, {
    method: "POST",
    headers: buildGrowthHeaders("growth", growthConfig.serviceRoleKey),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to upsert referral invitation: ${text || response.statusText}`);
    (error as { code?: string }).code = response.status === 409
      ? ERROR_CODES.DATA_CONFLICT
      : ERROR_CODES.UNKNOWN;
    throw error;
  }

  const data = await response.json() as InvitationRecord[];
  const inserted = Array.isArray(data) && data.length > 0 ? data[0] : undefined;
  const invitationId = inserted?.id ?? crypto.randomUUID();

  await ensureReferralBalance(growthConfig, inviterUserId);

  return jsonResponse({
    ok: true,
    request_id: requestId,
    invitation_id: invitationId,
    referral_code: inserted?.referral_code ?? referralCode,
    status: inserted?.status ?? "pending",
    link: buildReferralLink(inserted?.referral_code ?? referralCode),
  });
}, { fn: "referral-link", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

export { handler };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function normalizeChannel(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).filter((entry) => entry.length > 0);
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return ["email"];
}

function generateReferralCode(inviter: string, inviteeEmail: string): string {
  const suffix = inviteeEmail.split("@")[0]?.slice(0, 3) ?? "eco";
  return `${inviter.replace(/[^a-z0-9]/gi, "").slice(0, 5)}-${suffix}-${crypto.randomUUID().slice(0, 6)}`
    .toLowerCase();
}

function buildReferralLink(code: string): string {
  return `${REFERRAL_BASE_URL.replace(/\/$/, "")}/${encodeURIComponent(code)}`;
}

function logOfflineFallback(details: { requestId: string; reason: string }) {
  console.log(JSON.stringify({
    level: "WARN",
    event: "referral.offline_fallback",
    fn: "referral-link",
    request_id: details.requestId,
    reason: details.reason,
  }));
}

async function findExistingInvitation(args: {
  config: ReturnType<typeof resolveGrowthConfig>;
  inviterUserId: string;
  inviteeEmail: string;
  idempotencyKey?: string;
}): Promise<InvitationRecord | null> {
  const params = new URLSearchParams();
  params.set("select", "id,referral_code,status,consent_captured");
  params.set("limit", "1");

  if (args.idempotencyKey) {
    params.set("idempotency_key", `eq.${args.idempotencyKey}`);
  } else {
    params.set("inviter_user_id", `eq.${args.inviterUserId}`);
    params.set("invitee_email", `eq.${args.inviteeEmail}`);
  }

  const response = await fetch(`${args.config.url}/rest/v1/referral_invitations?${params.toString()}`, {
    method: "GET",
    headers: buildGetHeaders("growth", args.config.serviceRoleKey),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to lookup referral invitation: ${text || response.statusText}`);
    (error as { code?: string }).code = ERROR_CODES.UNKNOWN;
    throw error;
  }

  const data = await response.json() as InvitationRecord[];
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function ensureReferralBalance(config: ReturnType<typeof resolveGrowthConfig>, userId: string) {
  const lookupParams = new URLSearchParams();
  lookupParams.set("select", "id,available_cents,pending_cents");
  lookupParams.set("user_id", `eq.${userId}`);
  lookupParams.set("limit", "1");

  const lookup = await fetch(`${config.url}/rest/v1/referral_balances?${lookupParams.toString()}`, {
    method: "GET",
    headers: buildGetHeaders("growth", config.serviceRoleKey),
  });

  if (!lookup.ok) {
    const text = await lookup.text();
    const error = new Error(`Failed to fetch referral balance: ${text || lookup.statusText}`);
    (error as { code?: string }).code = ERROR_CODES.UNKNOWN;
    throw error;
  }

  const records = await lookup.json() as Array<{ id: string }>;
  if (Array.isArray(records) && records.length > 0) {
    return;
  }

  const insert = await fetch(`${config.url}/rest/v1/referral_balances`, {
    method: "POST",
    headers: buildGrowthHeaders("growth", config.serviceRoleKey),
    body: JSON.stringify({
      user_id: userId,
      available_cents: 0,
      pending_cents: 0,
      lifetime_referred: 0,
      lifetime_rewards_cents: 0,
    }),
  });

  if (!insert.ok) {
    const text = await insert.text();
    const error = new Error(`Failed to seed referral balance: ${text || insert.statusText}`);
    (error as { code?: string }).code = insert.status === 409
      ? ERROR_CODES.DATA_CONFLICT
      : ERROR_CODES.UNKNOWN;
    throw error;
  }
}
