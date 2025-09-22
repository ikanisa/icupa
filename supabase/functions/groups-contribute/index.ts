import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
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
  itinerary_id: string | null;
  currency: string;
  target_cents: number;
  min_members: number;
  deadline: string;
  status: string;
}

interface MembershipRow {
  id: string;
  group_id: string;
  user_id: string | null;
  role: string;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
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
      event: "groups.contribute",
      fn: "groups-contribute",
      ...fields,
    }),
  );
}

async function resolveAuth(req: Request): Promise<AuthInfo> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return { userId: null, isOps: false, actorLabel: "anonymous" };
  }

  if (SERVICE_ROLE_KEY && authHeader === `Bearer ${SERVICE_ROLE_KEY}`) {
    return { userId: null, isOps: true, actorLabel: "service-role" };
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return { userId: null, isOps: false, actorLabel: "unknown" };
  }

  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: authHeader,
      },
    });

    if (!userRes.ok) {
      return { userId: null, isOps: false, actorLabel: "unauthorized" };
    }

    const userData = await userRes.json();
    const userId = typeof userData?.id === "string" ? userData.id : null;
    if (!userId) {
      return { userId: null, isOps: false, actorLabel: "unauthorized" };
    }

    return { userId, isOps: false, actorLabel: userId };
  } catch (_error) {
    return { userId: null, isOps: false, actorLabel: "unknown" };
  }
}

async function fetchEscrow(escrowId: string): Promise<EscrowRow | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/group_escrows_view?select=id,group_id,itinerary_id,currency,target_cents,min_members,deadline,status&limit=1&id=eq.${escrowId}`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
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

  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    return null;
  }
  return rows[0] as EscrowRow;
}

async function fetchMembershipByUser(
  groupId: string,
  userId: string,
): Promise<MembershipRow | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/group_members_view?select=id,group_id,user_id,role&limit=1&group_id=eq.${groupId}&user_id=eq.${userId}`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Accept-Profile": "public",
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to load membership: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    return null;
  }
  return rows[0] as MembershipRow;
}

async function fetchMembershipById(
  memberId: string,
): Promise<MembershipRow | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/group_members_view?select=id,group_id,user_id,role&limit=1&id=eq.${memberId}`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Accept-Profile": "public",
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to load membership by id: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    return null;
  }
  return rows[0] as MembershipRow;
}

async function insertContribution(payload: Record<string, unknown>) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/insert_group_contribution`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Accept-Profile": "public",
        Prefer: "params=single-object",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to insert contribution: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }

  const data = await response.json();
  if (!data?.id) {
    throw new Error("Unexpected contribution insert response");
  }
  return data;
}

async function fetchContributionSummary(escrowId: string) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/group_contribution_summary`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
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

  const data = await response.json();
  return {
    total: Number(data?.total ?? 0),
    memberCount: Number(data?.member_count ?? 0),
  };
}

async function updateEscrowStatus(escrowId: string, status: string) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/escrows?id=eq.${escrowId}`,
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Accept-Profile": "group",
        "Content-Profile": "group",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to update escrow status: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }
}

async function ensurePaymentRecord(
  itineraryId: string | null,
  amount: number,
  currency: string,
  idempotency: string,
): Promise<string> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/ensure_payment_record`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Accept-Profile": "public",
        Prefer: "params=single-object",
      },
      body: JSON.stringify({
        p_itinerary: itineraryId,
        p_amount_cents: amount,
        p_currency: currency,
        p_idempotency: idempotency,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to create payment record: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }

  const data = await response.json();
  if (typeof data !== "string") {
    throw new Error("Unexpected payment record response");
  }
  return data;
}

async function deriveIdempotencyKey(parts: string[]): Promise<string> {
  const input = new TextEncoder().encode(parts.join(":"));
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 48);
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("groups-contribute");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, { status: 405 });
  }

  const auth = await resolveAuth(req);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, errors: ["Invalid JSON body"] }, {
      status: 400,
    });
  }

  const escrowId = typeof body?.escrow_id === "string" ? body.escrow_id : "";
  const amountCents = Number(body?.amount_cents);
  const currencyOverride = typeof body?.currency === "string"
    ? body.currency.toUpperCase()
    : null;
  const overrideUserId = typeof body?.user_id === "string"
    ? body.user_id
    : null;
  const overrideMemberId = typeof body?.member_id === "string"
    ? body.member_id
    : null;

  if (!escrowId || !/^[0-9a-fA-F-]{36}$/.test(escrowId)) {
    return jsonResponse({ ok: false, error: "escrow_id must be a UUID" }, {
      status: 400,
    });
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return jsonResponse({
      ok: false,
      error: "amount_cents must be a positive integer",
    }, { status: 400 });
  }

  let actingUserId = auth.userId;
  if (!actingUserId && auth.isOps && overrideUserId) {
    actingUserId = overrideUserId;
  }

  try {
    const escrow = await fetchEscrow(escrowId);
    if (!escrow) {
      return jsonResponse({ ok: false, error: "Escrow not found" }, {
        status: 404,
      });
    }

    const currency = currencyOverride ?? escrow.currency;
    if (currency !== escrow.currency) {
      return jsonResponse({ ok: false, error: "currency must match escrow" }, {
        status: 400,
      });
    }

    let membership: MembershipRow | null = null;
    if (overrideMemberId && auth.isOps) {
      membership = await fetchMembershipById(overrideMemberId);
    } else if (actingUserId) {
      membership = await fetchMembershipByUser(escrow.group_id, actingUserId);
    }

    if (!membership) {
      return jsonResponse({ ok: false, error: "Membership required" }, {
        status: 403,
      });
    }

    const idempotency = await deriveIdempotencyKey([
      membership.id,
      escrow.id,
      amountCents.toString(),
      currency,
    ]);

    const paymentId = await ensurePaymentRecord(
      escrow.itinerary_id,
      amountCents,
      currency,
      idempotency,
    );

    const contribution = await insertContribution({
      p_escrow: escrow.id,
      p_member: membership.id,
      p_amount: amountCents,
      p_currency: currency,
      p_payment: paymentId,
    });

    const summary = await fetchContributionSummary(escrow.id);
    let nextStatus = escrow.status;
    const now = Date.now();
    const deadlineMs = new Date(escrow.deadline).getTime();
    const goalMet = summary.total >= escrow.target_cents &&
      summary.memberCount >= escrow.min_members;

    if (goalMet && escrow.status !== "paid_out") {
      nextStatus = "met";
    } else if (!goalMet && deadlineMs < now && escrow.status === "open") {
      nextStatus = "expired";
    }

    if (nextStatus !== escrow.status) {
      await updateEscrowStatus(escrow.id, nextStatus);
    }

    audit({
      requestId,
      actor: auth.actorLabel,
      escrow: escrow.id,
      member: membership.id,
      amount: amountCents,
      currency,
      nextStatus,
    });

    return jsonResponse({
      ok: true,
      contribution_id: contribution.id,
      payment_id: paymentId,
      escrow_status: nextStatus,
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
}, { fn: "groups-contribute", defaultErrorCode: ERROR_CODES.UNKNOWN });

serve(handler);
