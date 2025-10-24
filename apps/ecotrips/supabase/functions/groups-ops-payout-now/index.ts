import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface AuthInfo {
  userId: string | null;
  isOps: boolean;
  actorLabel: string;
}

interface EscrowRow {
  id: string;
  group_id: string;
  status: string;
  currency: string;
}

interface PayoutRow {
  id: string;
  status: string;
  total_cents: number | null;
  last_error: string | null;
}

interface ContributionSummary {
  total: number;
}

function toJson(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

function audit(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "groups.ops_payout_now",
      fn: "groups-ops-payout-now",
      ...fields,
    }),
  );
}

function requireConfig() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }
}

async function resolveAuth(req: Request): Promise<AuthInfo> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return { userId: null, isOps: false, actorLabel: "anonymous" };
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return { userId: null, isOps: false, actorLabel: "unknown" };
  }

  if (authHeader === `Bearer ${SERVICE_ROLE_KEY}`) {
    return { userId: null, isOps: true, actorLabel: "service-role" };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      return { userId: null, isOps: false, actorLabel: "unauthorized" };
    }

    const payload = await response.json();
    const userId = typeof payload?.id === "string" ? payload.id : null;
    if (!userId) {
      return { userId: null, isOps: false, actorLabel: "unauthorized" };
    }

    return { userId, isOps: false, actorLabel: userId };
  } catch (_error) {
    return { userId: null, isOps: false, actorLabel: "unknown" };
  }
}

async function fetchIsOps(userId: string): Promise<boolean> {
  requireConfig();
  const serviceKey = SERVICE_ROLE_KEY!;
  const supabaseUrl = SUPABASE_URL!;

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/is_ops`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      "Accept-Profile": "sec",
      Prefer: "params=single-object",
    },
    body: JSON.stringify({ u: userId }),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to verify ops access: ${text}`);
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

async function fetchEscrow(escrowId: string): Promise<EscrowRow | null> {
  requireConfig();
  const serviceKey = SERVICE_ROLE_KEY!;
  const supabaseUrl = SUPABASE_URL!;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/group_escrows_view?select=id,group_id,status,currency&limit=1&id=eq.${escrowId}`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Accept-Profile": "public",
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to load escrow: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const payload = await response.json();
  if (!Array.isArray(payload) || !payload[0]) {
    return null;
  }
  return payload[0] as EscrowRow;
}

async function fetchContributionSummary(
  escrowId: string,
): Promise<ContributionSummary> {
  requireConfig();
  const serviceKey = SERVICE_ROLE_KEY!;
  const supabaseUrl = SUPABASE_URL!;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/group_contribution_summary`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "Accept-Profile": "public",
        Prefer: "params=single-object",
      },
      body: JSON.stringify({ p_escrow: escrowId }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to summarize contributions: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const payload = await response.json();
  const record = Array.isArray(payload) ? payload[0] : payload;
  const totalValue = Number(record?.total ?? 0);
  return { total: Number.isFinite(totalValue) ? totalValue : 0 };
}

async function findExistingPayout(escrowId: string): Promise<PayoutRow | null> {
  requireConfig();
  const serviceKey = SERVICE_ROLE_KEY!;
  const supabaseUrl = SUPABASE_URL!;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/group_payouts_view?select=id,status,total_cents,last_error&escrow_id=eq.${escrowId}&order=created_at.desc&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Accept-Profile": "public",
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to load payout: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const payload = await response.json();
  if (!Array.isArray(payload) || !payload[0]) {
    return null;
  }
  return payload[0] as PayoutRow;
}

async function insertPayout(
  escrowId: string,
  totalCents: number,
  currency: string,
  status: string,
  lastError?: string,
): Promise<PayoutRow> {
  requireConfig();
  const serviceKey = SERVICE_ROLE_KEY!;
  const supabaseUrl = SUPABASE_URL!;

  const body: Record<string, unknown> = {
    p_escrow: escrowId,
    p_total: totalCents,
    p_currency: currency,
    p_status: status,
    p_last_error: lastError ?? null,
  };

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/insert_group_payout`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "Accept-Profile": "public",
        "Content-Profile": "public",
        Prefer: "params=single-object",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to create payout: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }

  const payload = await response.json();
  return payload as PayoutRow;
}

async function updatePayoutStatus(payoutId: string, status: string) {
  requireConfig();
  const serviceKey = SERVICE_ROLE_KEY!;
  const supabaseUrl = SUPABASE_URL!;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/update_group_payout_status`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "Accept-Profile": "public",
        "Content-Profile": "public",
        Prefer: "params=single-object",
      },
      body: JSON.stringify({ p_payout: payoutId, p_status: status }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to update payout: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }
}

async function markEscrowPaid(escrowId: string) {
  requireConfig();
  const serviceKey = SERVICE_ROLE_KEY!;
  const supabaseUrl = SUPABASE_URL!;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/mark_group_escrow_paid`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "Accept-Profile": "public",
        "Content-Profile": "public",
        Prefer: "params=single-object",
      },
      body: JSON.stringify({ p_escrow: escrowId }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to mark escrow paid: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("groups-ops-payout-now");
  }

  if (req.method !== "POST") {
    return toJson({ ok: false, error: "POST required" }, { status: 405 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch (_error) {
    return toJson({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const escrowId =
    typeof (payload as Record<string, unknown>)?.escrow_id === "string"
      ? ((payload as Record<string, unknown>).escrow_id as string).trim()
      : "";

  if (!UUID_REGEX.test(escrowId)) {
    return toJson({ ok: false, error: "escrow_id must be a UUID" }, {
      status: 400,
    });
  }

  let auth: AuthInfo;
  try {
    auth = await resolveAuth(req);
  } catch (error) {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    (wrapped as { code?: string }).code ??= ERROR_CODES.AUTH_REQUIRED;
    throw wrapped;
  }

  let isOps = auth.isOps;
  try {
    if (!isOps && auth.userId) {
      isOps = await fetchIsOps(auth.userId);
    }
  } catch (error) {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    (wrapped as { code?: string }).code ??= ERROR_CODES.AUTH_REQUIRED;
    throw wrapped;
  }

  if (!isOps) {
    return toJson({ ok: false, error: "forbidden" }, { status: 403 });
  }

  requireConfig();

  try {
    const escrow = await fetchEscrow(escrowId);
    if (!escrow) {
      return toJson({ ok: false, error: "Escrow not found" }, { status: 404 });
    }

    const summary = await fetchContributionSummary(escrowId);
    const totalCents = Math.max(0, Math.trunc(summary.total ?? 0));
    let finalStatus = "skipped";
    let finalPayoutId: string | null = null;
    let finalTotal = totalCents;

    const existing = await findExistingPayout(escrowId);
    if (existing) {
      finalStatus = existing.status;
      finalPayoutId = existing.id;
      if (
        typeof existing.total_cents === "number" &&
        Number.isFinite(existing.total_cents)
      ) {
        finalTotal = existing.total_cents;
      }
    } else if (escrow.status === "met") {
      const payout = await insertPayout(
        escrow.id,
        totalCents,
        escrow.currency,
        "processing",
      );
      await updatePayoutStatus(payout.id, "succeeded");
      await markEscrowPaid(escrow.id);
      finalStatus = "succeeded";
      finalPayoutId = payout.id;
    } else if (escrow.status === "expired" && totalCents > 0) {
      const payout = await insertPayout(
        escrow.id,
        totalCents,
        escrow.currency,
        "failed",
        "expired_no_payout",
      );
      finalStatus = "failed";
      finalPayoutId = payout.id;
    }

    audit({
      requestId,
      actor: auth.actorLabel,
      escrow: escrowId,
      status: finalStatus,
      total: finalTotal,
    });

    return toJson({
      ok: true,
      request_id: requestId,
      escrow_id: escrowId,
      payout_id: finalPayoutId,
      payout_status: finalStatus,
      total_cents: finalTotal,
    });
  } catch (error) {
    audit({
      requestId,
      actor: auth.actorLabel,
      escrow: escrowId,
      status: "error",
    });
    const wrapped = error instanceof Error ? error : new Error(String(error));
    (wrapped as { code?: string }).code ??= ERROR_CODES.UNKNOWN;
    throw wrapped;
  }
}, { fn: "groups-ops-payout-now", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);
