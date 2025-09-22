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
      event: "groups.join",
      fn: "groups-join",
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

async function insertMembership(
  groupId: string,
  userId: string,
  role: string,
): Promise<{ id: string; role: string }> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/create_group_membership`,
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
        p_group: groupId,
        p_user: userId,
        p_role: role,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to insert membership: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }

  const data = await response.json();
  if (!data?.id) {
    throw new Error("Unexpected membership insert response");
  }
  return data as { id: string; role: string };
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("groups-join");
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

  const groupId = typeof body?.group_id === "string" ? body.group_id : "";
  const overrideUserId = typeof body?.user_id === "string"
    ? body.user_id
    : null;
  const desiredRole = typeof body?.role === "string" ? body.role : "member";

  if (!groupId || !/^[0-9a-fA-F-]{36}$/.test(groupId)) {
    return jsonResponse({ ok: false, error: "group_id must be a UUID" }, {
      status: 400,
    });
  }

  let actingUserId = auth.userId;
  if (!actingUserId && auth.isOps && overrideUserId) {
    actingUserId = overrideUserId;
  }

  if (!actingUserId) {
    return jsonResponse({ ok: false, error: "Authentication required" }, {
      status: 401,
    });
  }

  try {
    const existing = await fetchMembership(groupId, actingUserId);
    if (existing) {
      audit({
        requestId,
        actor: auth.actorLabel,
        group: groupId,
        member: existing.id,
        status: "existing",
      });
      return jsonResponse({
        ok: true,
        member_id: existing.id,
        role: existing.role,
      });
    }

    const inserted = await insertMembership(
      groupId,
      actingUserId,
      desiredRole === "owner" ? "owner" : "member",
    );

    audit({
      requestId,
      actor: auth.actorLabel,
      group: groupId,
      member: inserted.id,
      status: "created",
    });

    return jsonResponse({
      ok: true,
      member_id: inserted.id,
      role: inserted.role,
    });
  } catch (error) {
    audit({
      requestId,
      actor: auth.actorLabel,
      group: groupId,
      status: "error",
    });
    const wrapped = error instanceof Error ? error : new Error(String(error));
    (wrapped as { code?: string }).code ??= ERROR_CODES.UNKNOWN;
    throw wrapped;
  }
}, { fn: "groups-join", defaultErrorCode: ERROR_CODES.UNKNOWN });

serve(handler);
