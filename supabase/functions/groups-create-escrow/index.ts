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
      event: "groups.create_escrow",
      fn: "groups-create-escrow",
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

    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/core.profiles?select=persona&auth_user_id=eq.${userId}&limit=1`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      },
    );

    let isOps = false;
    if (profileRes.ok) {
      const rows = await profileRes.json();
      if (Array.isArray(rows) && rows[0]?.persona === "ops") {
        isOps = true;
      }
    }

    return { userId, isOps, actorLabel: userId };
  } catch (_error) {
    return { userId: null, isOps: false, actorLabel: "unknown" };
  }
}

async function fetchMembership(
  groupId: string,
  userId: string,
): Promise<{ id: string; role: string } | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/group_members_view?select=id,role&limit=1&group_id=eq.${groupId}&user_id=eq.${userId}`,
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
  return rows[0] as { id: string; role: string };
}

async function insertEscrow(payload: Record<string, unknown>) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/create_group_escrow`,
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
    const error = new Error(`Failed to create escrow: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }

  const data = await response.json();
  if (!data?.id) {
    throw new Error("Unexpected response from create_group_escrow");
  }
  return data;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("groups-create-escrow");
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

  const errors: string[] = [];
  const groupId = typeof body?.group_id === "string" ? body.group_id : "";
  const itineraryId = typeof body?.itinerary_id === "string"
    ? body.itinerary_id
    : null;
  const targetCents = Number(body?.target_cents);
  const minMembers = Number(body?.min_members ?? 2);
  const deadlineRaw = typeof body?.deadline === "string" ? body.deadline : "";
  const currency = typeof body?.currency === "string"
    ? body.currency.toUpperCase()
    : "USD";

  let actingUserId = auth.userId;
  if (!actingUserId && auth.isOps && typeof body?.user_id === "string") {
    actingUserId = body.user_id;
  }

  if (!groupId || !/^[0-9a-fA-F-]{36}$/.test(groupId)) {
    errors.push("group_id must be a UUID");
  }
  if (targetCents <= 0 || !Number.isInteger(targetCents)) {
    errors.push("target_cents must be a positive integer");
  }
  if (!Number.isInteger(minMembers) || minMembers < 1) {
    errors.push("min_members must be >= 1");
  }
  if (!deadlineRaw || Number.isNaN(new Date(deadlineRaw).getTime())) {
    errors.push("deadline must be ISO date-time");
  }
  if (!["USD", "EUR", "RWF"].includes(currency)) {
    errors.push("currency must be USD|EUR|RWF");
  }

  if (errors.length > 0) {
    return jsonResponse({ ok: false, errors }, { status: 400 });
  }

  if (!actingUserId && !auth.isOps) {
    return jsonResponse({ ok: false, error: "Authentication required" }, {
      status: 401,
    });
  }

  try {
    let ownerOk = auth.isOps;
    if (!ownerOk && actingUserId) {
      const membership = await fetchMembership(groupId, actingUserId);
      ownerOk = !!membership && membership.role === "owner";
    }

    if (!ownerOk) {
      return jsonResponse({
        ok: false,
        error: "Only owners may create escrows",
      }, { status: 403 });
    }

    const deadline = new Date(deadlineRaw);
    if (deadline.getTime() <= Date.now()) {
      return jsonResponse({
        ok: false,
        error: "deadline must be in the future",
      }, { status: 400 });
    }

    const row = await insertEscrow({
      p_group: groupId,
      p_itinerary: itineraryId,
      p_currency: currency,
      p_target: targetCents,
      p_min_members: minMembers,
      p_deadline: deadline.toISOString(),
    });

    audit({
      requestId,
      actor: auth.actorLabel,
      group: groupId,
      target: targetCents,
      currency,
    });

    return jsonResponse({ ok: true, escrow_id: row.id, status: row.status });
  } catch (error) {
    audit({ requestId, actor: auth.actorLabel, status: "error" });
    const wrapped = error instanceof Error ? error : new Error(String(error));
    (wrapped as { code?: string }).code ??= ERROR_CODES.UNKNOWN;
    throw wrapped;
  }
}, { fn: "groups-create-escrow", defaultErrorCode: ERROR_CODES.UNKNOWN });

serve(handler);
