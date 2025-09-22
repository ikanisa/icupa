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

interface CountRow {
  status: string;
  currency: string;
  count: number;
}

interface RecentRow {
  id: string;
  escrow_id: string;
  total_cents: number;
  currency: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
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
      event: "groups.payouts.report",
      fn: "groups-payouts-report",
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

function parseDateParam(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

async function fetchCounts(
  from: Date | null,
  to: Date | null,
): Promise<CountRow[]> {
  requireConfig();
  const serviceKey = SERVICE_ROLE_KEY!;
  const supabaseUrl = SUPABASE_URL!;

  const body: Record<string, unknown> = {
    p_from: from ? from.toISOString() : null,
    p_to: to ? to.toISOString() : null,
  };

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/group_payouts_counts`,
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
    const error = new Error(`Failed to load payout counts: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const payload = await response.json();
  const rows = Array.isArray(payload) ? payload : [payload];

  return rows.filter(Boolean).map((row) => ({
    status: typeof row.status === "string" ? row.status : "unknown",
    currency: typeof row.currency === "string" ? row.currency : "USD",
    count: Number(row.count ?? 0) || 0,
  }));
}

async function fetchRecent(
  from: Date | null,
  to: Date | null,
): Promise<RecentRow[]> {
  requireConfig();
  const serviceKey = SERVICE_ROLE_KEY!;
  const supabaseUrl = SUPABASE_URL!;

  const params = new URLSearchParams();
  params.set(
    "select",
    "id,escrow_id,total_cents,currency,status,attempts,last_error,created_at",
  );
  params.set("order", "created_at.desc");
  params.set("limit", "10");
  if (from) {
    params.append("created_at", `gte.${from.toISOString()}`);
  }
  if (to) {
    params.append("created_at", `lte.${to.toISOString()}`);
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/group_payouts_view?${params.toString()}`,
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
    const error = new Error(`Failed to load recent payouts: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map((row) => ({
    id: String(row.id ?? ""),
    escrow_id: String(row.escrow_id ?? ""),
    total_cents: Number(row.total_cents ?? 0) || 0,
    currency: typeof row.currency === "string" ? row.currency : "USD",
    status: typeof row.status === "string" ? row.status : "unknown",
    attempts: Number(row.attempts ?? 0) || 0,
    last_error: typeof row.last_error === "string" ? row.last_error : null,
    created_at: typeof row.created_at === "string"
      ? row.created_at
      : new Date().toISOString(),
  }));
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("groups-payouts-report");
  }

  if (req.method !== "GET") {
    return toJson({ ok: false, error: "GET required" }, { status: 405 });
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

  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const fromDate = parseDateParam(fromParam);
  const toDate = parseDateParam(toParam);

  if (fromParam && !fromDate) {
    return toJson({ ok: false, error: "Invalid from parameter" }, {
      status: 400,
    });
  }
  if (toParam && !toDate) {
    return toJson({ ok: false, error: "Invalid to parameter" }, {
      status: 400,
    });
  }

  try {
    const [counts, recent] = await Promise.all([
      fetchCounts(fromDate, toDate),
      fetchRecent(fromDate, toDate),
    ]);

    audit({
      requestId,
      actor: auth.actorLabel,
      from: fromParam ?? "",
      to: toParam ?? "",
      count: counts.length,
    });

    return toJson({
      ok: true,
      request_id: requestId,
      range: {
        from: fromParam ?? null,
        to: toParam ?? null,
      },
      counts,
      recent,
    });
  } catch (error) {
    audit({
      requestId,
      actor: auth.actorLabel,
      from: fromParam ?? "",
      to: toParam ?? "",
      status: "error",
    });
    const wrapped = error instanceof Error ? error : new Error(String(error));
    (wrapped as { code?: string }).code ??= ERROR_CODES.UNKNOWN;
    throw wrapped;
  }
}, { fn: "groups-payouts-report", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);
