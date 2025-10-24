import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Supabase configuration missing for payouts-recon");
}

const INTERNAL_FIXTURE_KEY = "finance.payouts.recon.internal";
const EXTERNAL_FIXTURE_KEY = "finance.payouts.recon.external";

interface InternalFixture {
  payout_id: string;
  escrow_id?: string;
  total_cents: number;
  currency: string;
  created_at?: string;
}

interface ExternalFixture {
  external_ref: string;
  amount_cents: number;
  currency: string;
  recorded_at?: string;
}

interface AuthInfo {
  userId: string | null;
  actorLabel: string;
  isOps: boolean;
}

interface PayoutExtRow {
  id: string;
  external_ref: string;
  amount_cents: number;
  currency: string;
  recorded_at: string;
  reconciled: boolean;
  internal_ref: string | null;
}

interface ReconCounts {
  total: number;
  reconciled: number;
  pending: number;
}

type NormalizedInternal = {
  payoutId: string;
  escrowId: string | null;
  totalCents: number;
  currency: string;
  createdAt: string | null;
};

type NormalizedExternal = {
  externalRef: string;
  amountCents: number;
  currency: string;
  recordedAt: string;
};

type MatchedRow = NormalizedInternal & { externalRef: string };

const handler = withObs(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("payouts-recon");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const auth = await resolveAuth(req.headers.get("authorization"));
  if (!auth.userId || !auth.isOps) {
    const error = new Error("ops access required");
    (error as { code?: string }).code = ERROR_CODES.AUTH_REQUIRED;
    throw error;
  }

  let dryRun = false;
  try {
    const body = await req.json();
    if (body && typeof body.dryRun === "boolean") {
      dryRun = body.dryRun;
    }
  } catch (_err) {
    // ignore empty body
  }

  const [internalFixtures, externalFixtures, existingRows] = await Promise.all([
    loadFixture<InternalFixture[]>(INTERNAL_FIXTURE_KEY),
    loadFixture<ExternalFixture[]>(EXTERNAL_FIXTURE_KEY),
    fetchPayoutExtRows(),
  ]);

  if (!internalFixtures || !externalFixtures) {
    const error = new Error("reconciliation fixtures missing");
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const normalizedInternal: NormalizedInternal[] = internalFixtures
    .filter((row) => row && typeof row.total_cents === "number")
    .map((row) => ({
      payoutId: row.payout_id,
      escrowId: row.escrow_id ?? null,
      totalCents: Number(row.total_cents) || 0,
      currency: typeof row.currency === "string" ? row.currency : "USD",
      createdAt: normalizeDate(row.created_at),
    }));

  const normalizedExternal: NormalizedExternal[] = externalFixtures
    .filter((row) => row && typeof row.amount_cents === "number" && typeof row.external_ref === "string")
    .map((row) => ({
      externalRef: row.external_ref,
      amountCents: Number(row.amount_cents) || 0,
      currency: typeof row.currency === "string" ? row.currency : "USD",
      recordedAt: normalizeDate(row.recorded_at) ?? new Date().toISOString(),
    }));

  const beforeCounts = summarizeCounts(existingRows);

  const matches = reconcile(normalizedInternal, normalizedExternal);
  const nowIso = new Date().toISOString();

  const upsertPayload = normalizedExternal.map((ext) => {
    const match = matches.matchedByExternal.get(ext.externalRef);
    const reconciled = Boolean(match);
    return {
      external_ref: ext.externalRef,
      provider: "stripe",
      amount_cents: ext.amountCents,
      currency: ext.currency,
      recorded_at: ext.recordedAt,
      reconciled,
      matched_at: reconciled ? nowIso : null,
      payout_id: reconciled ? match?.payoutId ?? null : null,
      internal_ref: reconciled ? match?.payoutId ?? null : null,
      internal_amount_cents: reconciled ? match?.totalCents ?? null : null,
      metadata: {
        source: "fixture",
        escrow_id: match?.escrowId ?? null,
        matched_via: reconciled ? "amount_currency" : "unmatched",
      },
    };
  });

  if (!dryRun && upsertPayload.length > 0) {
    await upsertPayoutExt(upsertPayload);
  }

  const afterRows = dryRun ? existingRows : await fetchPayoutExtRows();
  const afterCounts = dryRun ? beforeCounts : summarizeCounts(afterRows);

  console.log(
    JSON.stringify({
      level: "INFO",
      event: "finance.payouts.recon",
      fn: "payouts-recon",
      stage: "before",
      requestId,
      counts: beforeCounts,
    }),
  );
  console.log(
    JSON.stringify({
      level: "INFO",
      event: "finance.payouts.recon",
      fn: "payouts-recon",
      stage: dryRun ? "after:dry_run" : "after",
      requestId,
      counts: afterCounts,
      matched: matches.matched.length,
      unmatched_internal: matches.unmatchedInternal.map((row) => row.payoutId),
      unmatched_external: matches.unmatchedExternal.map((row) => row.externalRef),
    }),
  );

  return jsonResponse({
    ok: true,
    dryRun,
    counts: {
      before: beforeCounts,
      after: afterCounts,
    },
    matched: matches.matched.map((entry) => ({
      payout_id: entry.payoutId,
      external_ref: entry.externalRef,
      amount_cents: entry.totalCents,
      currency: entry.currency,
    })),
    unmatched_internal: matches.unmatchedInternal.map((row) => ({
      payout_id: row.payoutId,
      total_cents: row.totalCents,
      currency: row.currency,
    })),
    unmatched_external: matches.unmatchedExternal.map((row) => ({
      external_ref: row.externalRef,
      amount_cents: row.amountCents,
      currency: row.currency,
    })),
  });
}, { fn: "payouts-recon", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function normalizeDate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

async function resolveAuth(header: string | null): Promise<AuthInfo> {
  if (!header) {
    return { userId: null, actorLabel: "anonymous", isOps: false };
  }

  if (header === `Bearer ${SERVICE_ROLE_KEY}`) {
    return { userId: null, actorLabel: "service-role", isOps: true };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: header,
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
  } catch (_err) {
    return { userId: null, actorLabel: "unknown", isOps: false };
  }
}

async function fetchIsOps(userId: string): Promise<boolean> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_ops`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Accept-Profile": "sec",
      Prefer: "params=single-object",
    },
    body: JSON.stringify({ u: userId }),
  });

  if (!response.ok) {
    return false;
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

async function loadFixture<T>(key: string): Promise<T | null> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/ops_console_fixtures`);
  url.searchParams.set("select", "payload");
  url.searchParams.set("key", `eq.${key}`);

  const response = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Accept-Profile": "ops",
      "Content-Profile": "ops",
    },
  });

  if (!response.ok) {
    return null;
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  const payload = rows[0]?.payload;
  return (payload ?? null) as T | null;
}

async function fetchPayoutExtRows(): Promise<PayoutExtRow[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/fin_payouts_ext`);
  url.searchParams.set("select", "id,external_ref,amount_cents,currency,recorded_at,reconciled,internal_ref");

  const response = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Accept-Profile": "fin",
    },
  });

  if (!response.ok) {
    return [];
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.map((row) => ({
    id: String(row.id ?? ""),
    external_ref: String(row.external_ref ?? ""),
    amount_cents: Number(row.amount_cents ?? 0) || 0,
    currency: typeof row.currency === "string" ? row.currency : "USD",
    recorded_at: typeof row.recorded_at === "string"
      ? row.recorded_at
      : new Date().toISOString(),
    reconciled: Boolean(row.reconciled),
    internal_ref: typeof row.internal_ref === "string" ? row.internal_ref : null,
  }));
}

async function upsertPayoutExt(rows: unknown[]): Promise<void> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/fin_payouts_ext?on_conflict=external_ref`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Accept-Profile": "fin",
        "Content-Profile": "fin",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`failed to upsert payouts_ext: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.UNKNOWN;
    throw error;
  }
}

function summarizeCounts(rows: PayoutExtRow[]): ReconCounts {
  const total = rows.length;
  const reconciled = rows.filter((row) => row.reconciled).length;
  return {
    total,
    reconciled,
    pending: total - reconciled,
  };
}

interface MatchResult {
  matched: MatchedRow[];
  matchedByExternal: Map<string, MatchedRow>;
  unmatchedInternal: NormalizedInternal[];
  unmatchedExternal: NormalizedExternal[];
}

function reconcile(
  internalRows: NormalizedInternal[],
  externalRows: NormalizedExternal[],
): MatchResult {
  const unmatchedInternal = [...internalRows];
  const unmatchedExternal = [...externalRows];
  const matched: MatchedRow[] = [];
  const matchedByExternal = new Map<string, MatchedRow>();

  for (const internal of internalRows) {
    const index = unmatchedExternal.findIndex((ext) =>
      ext.amountCents === internal.totalCents && ext.currency === internal.currency
    );
    if (index === -1) {
      continue;
    }
    const [external] = unmatchedExternal.splice(index, 1);
    matched.push({
      payoutId: internal.payoutId,
      escrowId: internal.escrowId,
      totalCents: internal.totalCents,
      currency: internal.currency,
      externalRef: external.externalRef,
    });
    matchedByExternal.set(external.externalRef, matched[matched.length - 1]);
    const internalIndex = unmatchedInternal.findIndex((row) => row.payoutId === internal.payoutId);
    if (internalIndex !== -1) {
      unmatchedInternal.splice(internalIndex, 1);
    }
  }

  return { matched, matchedByExternal, unmatchedInternal, unmatchedExternal };
}
