import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface EscrowRow {
  id: string;
  group_id: string;
  currency: string;
  status: string;
}

interface PayoutRow {
  id: string;
  status: string;
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
      event: "groups.payout.worker",
      fn: "groups-payout-worker",
      ...fields,
    }),
  );
}

function requireConfig() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }
}

async function fetchEscrowsByStatus(status: string): Promise<EscrowRow[]> {
  requireConfig();
  const serviceKey = SERVICE_ROLE_KEY!;
  const supabaseUrl = SUPABASE_URL!;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/group_escrows_view?select=id,group_id,currency,status&status=eq.${status}`,
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
    const error = new Error(`Failed to load escrows: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    return [];
  }
  return data as EscrowRow[];
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

async function hasExistingPayout(escrowId: string): Promise<boolean> {
  requireConfig();
  const serviceKey = SERVICE_ROLE_KEY!;
  const supabaseUrl = SUPABASE_URL!;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/group_payouts_view?select=id&escrow_id=eq.${escrowId}&limit=1`,
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
    const error = new Error(`Failed to inspect payouts: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const payload = await response.json();
  return Array.isArray(payload) && payload.length > 0;
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

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("groups-payout-worker");
  }

  if (req.method !== "POST") {
    return toJson({ ok: false, error: "POST required" }, { status: 405 });
  }

  requireConfig();

  const processed: Array<Record<string, unknown>> = [];
  const errors: Array<{ escrow_id: string; error: string }> = [];

  try {
    const metEscrows = await fetchEscrowsByStatus("met");
    for (const escrow of metEscrows) {
      if (!escrow?.id) {
        continue;
      }

      try {
        const alreadyHandled = await hasExistingPayout(escrow.id);
        if (alreadyHandled) {
          continue;
        }

        const summary = await fetchContributionSummary(escrow.id);
        const totalCents = Math.max(0, Math.trunc(summary.total ?? 0));
        const payout = await insertPayout(
          escrow.id,
          totalCents,
          escrow.currency,
          "processing",
        );

        await updatePayoutStatus(payout.id, "succeeded");
        await markEscrowPaid(escrow.id);

        processed.push({
          escrow_id: escrow.id,
          payout_id: payout.id,
          status: "succeeded",
          total_cents: totalCents,
        });
        audit({ escrow_id: escrow.id, status: "succeeded", total: totalCents });
      } catch (error) {
        const message = (error as Error).message ?? "unknown";
        errors.push({ escrow_id: escrow.id, error: message });
        audit({ escrow_id: escrow.id, status: "error", total: 0 });
      }
    }

    const expiredEscrows = await fetchEscrowsByStatus("expired");
    for (const escrow of expiredEscrows) {
      if (!escrow?.id) {
        continue;
      }

      try {
        const alreadyHandled = await hasExistingPayout(escrow.id);
        if (alreadyHandled) {
          continue;
        }

        const summary = await fetchContributionSummary(escrow.id);
        const totalCents = Math.max(0, Math.trunc(summary.total ?? 0));
        if (totalCents <= 0) {
          continue;
        }

        const payout = await insertPayout(
          escrow.id,
          totalCents,
          escrow.currency,
          "failed",
          "expired_no_payout",
        );

        processed.push({
          escrow_id: escrow.id,
          payout_id: payout.id,
          status: "failed",
          total_cents: totalCents,
        });
        audit({ escrow_id: escrow.id, status: "failed", total: totalCents });
      } catch (error) {
        const message = (error as Error).message ?? "unknown";
        errors.push({ escrow_id: escrow.id, error: message });
        audit({ escrow_id: escrow.id, status: "error", total: 0 });
      }
    }
  } catch (error) {
    errors.push({
      escrow_id: "*",
      error: (error as Error).message ?? "unknown",
    });
  }

  return toJson({ ok: true, request_id: requestId, processed, errors });
}, { fn: "groups-payout-worker", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);
