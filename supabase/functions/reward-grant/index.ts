import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { buildGetHeaders, buildGrowthHeaders, resolveGrowthConfig } from "../_shared/growth.ts";

interface RewardRequestBody {
  user_id?: unknown;
  amount_cents?: unknown;
  currency?: unknown;
  source?: unknown;
  status?: unknown;
  referral_invitation_id?: unknown;
  idempotency_key?: unknown;
  metadata?: unknown;
  referred_increment?: unknown;
  consent?: unknown;
}

interface RewardLedgerRow {
  id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  idempotency_key: string | null;
}

interface BalanceRow {
  id: string;
  available_cents: number;
  pending_cents: number;
  lifetime_rewards_cents: number;
  lifetime_referred: number;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("reward-grant");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  let body: RewardRequestBody;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const userId = typeof body.user_id === "string" ? body.user_id : "";
  const amountCents = typeof body.amount_cents === "number"
    ? Math.trunc(body.amount_cents)
    : Number(body.amount_cents ?? 0);
  const currency = typeof body.currency === "string" && body.currency.length >= 3
    ? body.currency
    : "USD";
  const source = typeof body.source === "string" && body.source.length > 0
    ? body.source
    : "referral";
  const status = normalizeStatus(body.status);
  const referralInvitationId = typeof body.referral_invitation_id === "string"
    ? body.referral_invitation_id
    : undefined;
  const idempotencyKey = typeof body.idempotency_key === "string" && body.idempotency_key.length > 0
    ? body.idempotency_key
    : undefined;
  const referredIncrement = typeof body.referred_increment === "number"
    ? Math.max(0, Math.trunc(body.referred_increment))
    : 0;
  const metadata = typeof body.metadata === "object" && body.metadata !== null
    ? body.metadata
    : {};
  const consent = body.consent === true;

  const errors: string[] = [];
  if (!userId) errors.push("user_id required");
  if (!Number.isFinite(amountCents) || amountCents <= 0) errors.push("amount_cents must be > 0");
  if (!idempotencyKey) errors.push("idempotency_key required");
  if (!consent) errors.push("consent required");

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const growthConfig = resolveGrowthConfig({ offlineFlag: "GROWTH_REWARD_OFFLINE" });

  if (growthConfig.offline) {
    logOfflineFallback({ requestId, reason: growthConfig.reason ?? "offline" });
    return jsonResponse({
      ok: true,
      request_id: requestId,
      mode: "offline",
      status,
      ledger_entry: {
        id: crypto.randomUUID(),
        user_id: userId,
        amount_cents: amountCents,
        currency,
        source,
        status,
      },
    });
  }

  const existing = await findExistingLedger(growthConfig, idempotencyKey);
  if (existing) {
    return jsonResponse({
      ok: true,
      request_id: requestId,
      reused: true,
      ledger_entry: existing,
    });
  }

  const ledgerResponse = await fetch(`${growthConfig.url}/rest/v1/reward_ledger`, {
    method: "POST",
    headers: buildGrowthHeaders("growth", growthConfig.serviceRoleKey),
    body: JSON.stringify({
      user_id: userId,
      referral_invitation_id: referralInvitationId ?? null,
      source,
      amount_cents: amountCents,
      currency,
      status,
      idempotency_key: idempotencyKey,
      metadata: {
        ...metadata as Record<string, unknown>,
        request_id: requestId,
      },
    }),
  });

  if (!ledgerResponse.ok) {
    const text = await ledgerResponse.text();
    const error = new Error(`Failed to insert reward ledger: ${text || ledgerResponse.statusText}`);
    (error as { code?: string }).code = ledgerResponse.status === 409
      ? ERROR_CODES.DATA_CONFLICT
      : ERROR_CODES.UNKNOWN;
    throw error;
  }

  const ledgerData = await ledgerResponse.json() as RewardLedgerRow[];
  const ledgerEntry = Array.isArray(ledgerData) && ledgerData.length > 0
    ? ledgerData[0]
    : {
      id: crypto.randomUUID(),
      user_id: userId,
      amount_cents: amountCents,
      currency,
      status,
      idempotency_key: idempotencyKey,
    };

  await applyBalanceAdjustments({
    config: growthConfig,
    userId,
    amountCents,
    status,
    currency,
    referredIncrement,
  });

  return jsonResponse({
    ok: true,
    request_id: requestId,
    ledger_entry: ledgerEntry,
  });
}, { fn: "reward-grant", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

export { handler };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function normalizeStatus(value: unknown): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return "pending";
}

function logOfflineFallback(details: { requestId: string; reason: string }) {
  console.log(JSON.stringify({
    level: "WARN",
    event: "reward.offline_fallback",
    fn: "reward-grant",
    request_id: details.requestId,
    reason: details.reason,
  }));
}

async function findExistingLedger(config: ReturnType<typeof resolveGrowthConfig>, idempotencyKey: string) {
  const params = new URLSearchParams();
  params.set("select", "id,user_id,amount_cents,currency,status,idempotency_key");
  params.set("idempotency_key", `eq.${idempotencyKey}`);
  params.set("limit", "1");

  const response = await fetch(`${config.url}/rest/v1/reward_ledger?${params.toString()}`, {
    method: "GET",
    headers: buildGetHeaders("growth", config.serviceRoleKey),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to lookup reward ledger: ${text || response.statusText}`);
    (error as { code?: string }).code = ERROR_CODES.UNKNOWN;
    throw error;
  }

  const data = await response.json() as RewardLedgerRow[];
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function applyBalanceAdjustments(args: {
  config: ReturnType<typeof resolveGrowthConfig>;
  userId: string;
  amountCents: number;
  status: string;
  currency: string;
  referredIncrement: number;
}) {
  const { config, userId, amountCents, status, currency, referredIncrement } = args;

  const params = new URLSearchParams();
  params.set("select", "id,available_cents,pending_cents,lifetime_rewards_cents,lifetime_referred");
  params.set("user_id", `eq.${userId}`);
  params.set("limit", "1");

  const response = await fetch(`${config.url}/rest/v1/referral_balances?${params.toString()}`, {
    method: "GET",
    headers: buildGetHeaders("growth", config.serviceRoleKey),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to load referral balance: ${text || response.statusText}`);
    (error as { code?: string }).code = ERROR_CODES.UNKNOWN;
    throw error;
  }

  const records = await response.json() as BalanceRow[];
  const existing = Array.isArray(records) && records.length > 0 ? records[0] : null;

  const nowIso = new Date().toISOString();
  const granted = status === "granted";
  const pending = status === "pending";

  if (!existing) {
    const insert = await fetch(`${config.url}/rest/v1/referral_balances`, {
      method: "POST",
      headers: buildGrowthHeaders("growth", config.serviceRoleKey),
      body: JSON.stringify({
        user_id: userId,
        available_cents: granted ? amountCents : 0,
        pending_cents: pending ? amountCents : 0,
        currency,
        lifetime_referred: referredIncrement,
        lifetime_rewards_cents: granted ? amountCents : 0,
        updated_at: nowIso,
      }),
    });

    if (!insert.ok) {
      const text = await insert.text();
      const error = new Error(`Failed to create referral balance: ${text || insert.statusText}`);
      (error as { code?: string }).code = insert.status === 409
        ? ERROR_CODES.DATA_CONFLICT
        : ERROR_CODES.UNKNOWN;
      throw error;
    }
    return;
  }

  const updated = {
    available_cents: existing.available_cents + (granted ? amountCents : 0),
    pending_cents: Math.max(0, existing.pending_cents + (pending ? amountCents : 0)),
    lifetime_rewards_cents: existing.lifetime_rewards_cents + (granted ? amountCents : 0),
    lifetime_referred: existing.lifetime_referred + referredIncrement,
    updated_at: nowIso,
  };

  const patch = await fetch(`${config.url}/rest/v1/referral_balances?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      ...buildGrowthHeaders("growth", config.serviceRoleKey),
      Prefer: "return=representation",
    },
    body: JSON.stringify(updated),
  });

  if (!patch.ok) {
    const text = await patch.text();
    const error = new Error(`Failed to update referral balance: ${text || patch.statusText}`);
    (error as { code?: string }).code = patch.status === 409
      ? ERROR_CODES.DATA_CONFLICT
      : ERROR_CODES.UNKNOWN;
    throw error;
  }
}
