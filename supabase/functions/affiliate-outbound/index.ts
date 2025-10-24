import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import {
  AFFILIATE_SERVICE_ROLE_KEY,
  AFFILIATE_SUPABASE_URL,
  computeAffiliateSignature,
  fetchAffiliatePartner,
  insertAffiliateEvent,
} from "../_shared/affiliate.ts";

interface AuthInfo {
  userId: string | null;
  actorLabel: string;
  isOps: boolean;
}

interface OutboundInput {
  partner: string;
  event: string;
  payload?: Record<string, unknown> | null;
  dryRun?: boolean;
  note?: string | null;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("affiliate-outbound");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST required" }, 405);
  }

  const auth = await resolveAuth(req);
  if (!auth.isOps) {
    const error = new Error("Ops role required");
    (error as { code?: string }).code = ERROR_CODES.AUTH_REQUIRED;
    throw error;
  }

  let payload: OutboundInput | null = null;
  try {
    payload = normalizeInput(await req.json());
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  if (!payload || !payload.partner || !payload.event) {
    return jsonResponse({ ok: false, error: "partner_and_event_required" }, 400);
  }

  let partner;
  try {
    partner = await fetchAffiliatePartner(payload.partner);
  } catch (error) {
    console.error("affiliate-outbound.partner_load_error", error);
    return jsonResponse({ ok: false, error: "partner_lookup_failed", request_id: requestId }, 502);
  }

  if (!partner) {
    return jsonResponse({ ok: false, error: "partner_not_found", request_id: requestId }, 404);
  }

  if (!partner.active) {
    return jsonResponse({ ok: false, error: "partner_inactive", request_id: requestId }, 409);
  }

  const dryRun = payload.dryRun ?? true;
  const partnerSlug = (partner.slug ?? payload.partner).toLowerCase();
  const bodyPayload = payload.payload ?? {};
  const rawBody = JSON.stringify(bodyPayload);

  const timestamp = Math.floor(Date.now() / 1000).toString();
  let signature: string | null = null;
  let signatureStatus: "valid" | "missing" = "missing";

  if (partner.signing_secret) {
    signature = await computeAffiliateSignature(partner.signing_secret, timestamp, rawBody);
    signatureStatus = "valid";
  }

  const signatureHeader = signature ? `t=${timestamp},v1=${signature}` : null;

  const eventRow = await insertAffiliateEvent({
    partner,
    partnerSlug,
    direction: "outbound",
    eventType: payload.event,
    requestId,
    signature: {
      provided: signature,
      computed: signature,
      version: signature ? "v1" : null,
      status: signatureStatus,
      error: signature ? null : "signing secret missing",
      timestamp,
    },
    rawBody,
    payload: bodyPayload,
    headers: {
      "x-eco-affiliate-partner": partnerSlug,
      "x-eco-affiliate-timestamp": timestamp,
      "x-eco-affiliate-signature": signatureHeader,
      "content-type": "application/json",
    },
    metadata: {
      request_id: requestId,
      dry_run: dryRun,
      actor: auth.actorLabel,
      note: payload.note ?? null,
      partner_slug: partnerSlug,
      event_type: payload.event,
    },
  });

  console.log(JSON.stringify({
    level: "INFO",
    event: "affiliate.outbound",
    fn: "affiliate-outbound",
    requestId,
    partner: partnerSlug,
    actor: auth.actorLabel,
    dryRun,
    signaturePresent: Boolean(signature),
  }));

  return jsonResponse({
    ok: true,
    request_id: requestId,
    event_id: eventRow.id,
    signature: signatureHeader,
    timestamp,
    dry_run: dryRun,
  });
}, { fn: "affiliate-outbound", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function normalizeInput(input: unknown): OutboundInput {
  if (!input || typeof input !== "object") {
    throw new Error("invalid_json");
  }
  const record = input as Record<string, unknown>;
  const partner = typeof record.partner === "string"
    ? record.partner.trim().toLowerCase()
    : "";
  const event = typeof record.event === "string" ? record.event.trim() : "";
  const dryRun = record.dryRun === false || record.dryRun === "false"
    ? false
    : true;
  const noteRaw = typeof record.note === "string" ? record.note.trim() : null;
  const note = noteRaw && noteRaw.length > 0 ? noteRaw : null;

  let payload: Record<string, unknown> | null = null;
  if (record.payload && typeof record.payload === "object") {
    payload = record.payload as Record<string, unknown>;
  } else if (typeof record.payload === "string" && record.payload.trim().length > 0) {
    try {
      const parsed = JSON.parse(record.payload);
      if (parsed && typeof parsed === "object") {
        payload = parsed as Record<string, unknown>;
      }
    } catch (_error) {
      payload = { raw: record.payload } as Record<string, unknown>;
    }
  }

  return {
    partner,
    event,
    dryRun,
    note,
    payload: payload ?? {},
  };
}

async function resolveAuth(req: Request): Promise<AuthInfo> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader) {
    return { userId: null, actorLabel: "anonymous", isOps: false };
  }

  if (!AFFILIATE_SUPABASE_URL || !AFFILIATE_SERVICE_ROLE_KEY) {
    return { userId: null, actorLabel: "unknown", isOps: false };
  }

  if (authHeader === `Bearer ${AFFILIATE_SERVICE_ROLE_KEY}`) {
    return { userId: null, actorLabel: "service-role", isOps: true };
  }

  try {
    const response = await fetch(`${AFFILIATE_SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: authHeader,
        apikey: AFFILIATE_SERVICE_ROLE_KEY,
      },
    });

    if (!response.ok) {
      return { userId: null, actorLabel: "unauthorized", isOps: false };
    }

    const payload = await response.json();
    const userId = typeof payload?.id === "string" ? payload.id : null;
    if (!userId) {
      return { userId: null, actorLabel: "unauthorized", isOps: false };
    }

    const isOps = await fetchIsOps(userId);
    return { userId, actorLabel: userId, isOps };
  } catch (error) {
    console.error("affiliate-outbound.auth_error", error);
    return { userId: null, actorLabel: "unknown", isOps: false };
  }
}

async function fetchIsOps(userId: string): Promise<boolean> {
  if (!AFFILIATE_SUPABASE_URL || !AFFILIATE_SERVICE_ROLE_KEY) {
    return false;
  }
  const response = await fetch(`${AFFILIATE_SUPABASE_URL}/rest/v1/rpc/is_ops`, {
    method: "POST",
    headers: {
      apikey: AFFILIATE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${AFFILIATE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Accept-Profile": "sec",
      Prefer: "params=single-object",
    },
    body: JSON.stringify({ u: userId }),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to verify ops role: ${text || response.statusText}`);
    (error as { code?: string }).code = ERROR_CODES.AUTH_REQUIRED;
    throw error;
  }

  const payload = await response.json();
  if (typeof payload === "boolean") {
    return payload;
  }
  if (payload && typeof payload.boolean === "boolean") {
    return payload.boolean;
  }
  return Boolean(payload);
}
