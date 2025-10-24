import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { assertOpsAccess, resolveUserContext } from "../_shared/auth.ts";
import { getSupabaseServiceConfig } from "../_shared/env.ts";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "loyalty" });

const LOYALTY_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Accept-Profile": "loyalty",
  "Content-Profile": "loyalty",
} as const;

const LEDGER_HEADERS = {
  ...LOYALTY_HEADERS,
  Prefer: "return=representation",
  "Content-Type": "application/json",
} as const;

interface LoyaltyAccountRow {
  id: string;
  profile_id: string;
  points_balance: number;
  tier: string;
}

interface LoyaltyLedgerRow {
  id: string;
  account_id: string;
  points_delta: number;
  request_key: string | null;
}

interface GrantRequest {
  profileId: string;
  itineraryId?: string;
  points: number;
  reason: string;
  source: string;
  requestKey?: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("loyalty-grant");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  const user = await resolveUserContext(req);
  assertOpsAccess(user);

  let raw: Record<string, unknown>;
  try {
    raw = await req.json() as Record<string, unknown>;
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const parsed = parseGrantRequest(raw);
  const derivedKey = parsed.requestKey ?? await deriveRequestKey([
    parsed.profileId,
    parsed.reason,
    String(parsed.points),
    parsed.itineraryId ?? "none",
  ]);

  const existing = await fetchLedgerByRequestKey(derivedKey);
  if (existing) {
    const account = await fetchAccountById(existing.account_id);
    logEvent({
      requestId,
      profileId: account?.profile_id ?? parsed.profileId,
      ledgerId: existing.id,
      reused: true,
    });
    return jsonResponse({
      ok: true,
      account_id: account?.id,
      balance: account?.points_balance,
      points_awarded: existing.points_delta,
      tier: account?.tier,
      message: "Reused existing grant",
      request_id: derivedKey,
    });
  }

  const account = await ensureAccount(parsed.profileId);
  const newBalance = account.points_balance + parsed.points;
  const tier = resolveTier(newBalance);

  const ledger = await insertLedger({
    accountId: account.id,
    itineraryId: parsed.itineraryId,
    points: parsed.points,
    reason: parsed.reason,
    source: parsed.source,
    requestKey: derivedKey,
  });

  await updateAccount(account.id, {
    points_balance: newBalance,
    tier,
    last_awarded_at: new Date().toISOString(),
  });

  logEvent({
    requestId,
    profileId: parsed.profileId,
    ledgerId: ledger.id,
    points: parsed.points,
    tier,
  });

  return jsonResponse({
    ok: true,
    account_id: account.id,
    balance: newBalance,
    points_awarded: parsed.points,
    tier,
    request_id: derivedKey,
  });
}, { fn: "loyalty-grant", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

export { handler };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function parseGrantRequest(body: Record<string, unknown>): GrantRequest {
  const errors: string[] = [];
  const profileId = typeof body.profile_id === "string" ? body.profile_id.trim() : "";
  const itineraryId = typeof body.itinerary_id === "string" ? body.itinerary_id.trim() : undefined;
  const points = Number(body.points);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const source = typeof body.source === "string" ? body.source.trim() : "manual";
  const requestKey = typeof body.request_key === "string" ? body.request_key.trim() : undefined;

  if (!UUID_REGEX.test(profileId)) {
    errors.push("profile_id must be a UUID");
  }
  if (itineraryId && !UUID_REGEX.test(itineraryId)) {
    errors.push("itinerary_id must be a UUID when provided");
  }
  if (!Number.isInteger(points) || points <= 0) {
    errors.push("points must be a positive integer");
  }
  if (!reason || reason.length < 3) {
    errors.push("reason must be at least 3 characters");
  }
  if (requestKey && (requestKey.length < 6 || requestKey.length > 128)) {
    errors.push("request_key must be 6-128 characters when provided");
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  return { profileId, itineraryId, points, reason, source, requestKey };
}

async function deriveRequestKey(parts: string[]): Promise<string> {
  const encoder = new TextEncoder();
  const payload = encoder.encode(parts.join(":"));
  const digest = await crypto.subtle.digest("SHA-256", payload);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `loyalty-${hex.slice(0, 32)}`;
}

async function fetchLedgerByRequestKey(key: string): Promise<LoyaltyLedgerRow | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/loyalty.ledger?select=id,account_id,points_delta,request_key&limit=1&request_key=eq.${encodeURIComponent(key)}`,
    { headers: LOYALTY_HEADERS },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to load loyalty ledger: ${text}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    return null;
  }
  return rows[0] as LoyaltyLedgerRow;
}

async function fetchAccountById(accountId: string): Promise<LoyaltyAccountRow | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/loyalty.accounts?select=id,profile_id,points_balance,tier&limit=1&id=eq.${accountId}`,
    { headers: LOYALTY_HEADERS },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to load loyalty account: ${text}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    return null;
  }
  return rows[0] as LoyaltyAccountRow;
}

async function ensureAccount(profileId: string): Promise<LoyaltyAccountRow> {
  const existing = await fetch(
    `${SUPABASE_URL}/rest/v1/loyalty.accounts?select=id,profile_id,points_balance,tier&limit=1&profile_id=eq.${profileId}`,
    { headers: LOYALTY_HEADERS },
  );
  if (!existing.ok) {
    const text = await existing.text();
    throw new Error(`Failed to load loyalty account: ${text}`);
  }
  const rows = await existing.json();
  if (Array.isArray(rows) && rows[0]) {
    return rows[0] as LoyaltyAccountRow;
  }

  const created = await fetch(`${SUPABASE_URL}/rest/v1/loyalty.accounts`, {
    method: "POST",
    headers: {
      ...LEDGER_HEADERS,
    },
    body: JSON.stringify({
      profile_id: profileId,
      points_balance: 0,
      tier: "starter",
    }),
  });
  if (!created.ok) {
    const text = await created.text();
    throw new Error(`Failed to create loyalty account: ${text}`);
  }
  const inserted = await created.json();
  if (!Array.isArray(inserted) || !inserted[0]) {
    throw new Error("Unexpected response creating loyalty account");
  }
  return inserted[0] as LoyaltyAccountRow;
}

async function insertLedger(params: {
  accountId: string;
  itineraryId?: string;
  points: number;
  reason: string;
  source: string;
  requestKey: string;
}): Promise<LoyaltyLedgerRow> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/loyalty.ledger`, {
    method: "POST",
    headers: {
      ...LEDGER_HEADERS,
    },
    body: JSON.stringify({
      account_id: params.accountId,
      itinerary_id: params.itineraryId,
      points_delta: params.points,
      reason: params.reason,
      source: params.source,
      request_key: params.requestKey,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to insert loyalty ledger: ${text}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    throw new Error("Unexpected response inserting loyalty ledger");
  }
  return rows[0] as LoyaltyLedgerRow;
}

async function updateAccount(accountId: string, fields: Record<string, unknown>) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/loyalty.accounts?id=eq.${accountId}`,
    {
      method: "PATCH",
      headers: {
        ...LEDGER_HEADERS,
      },
      body: JSON.stringify(fields),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update loyalty account: ${text}`);
  }
}

function resolveTier(points: number): string {
  if (points >= 5000) return "platinum";
  if (points >= 2000) return "gold";
  if (points >= 500) return "silver";
  return "starter";
}

function logEvent(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "loyalty.grant",
      fn: "loyalty-grant",
      ...fields,
    }),
  );
}
