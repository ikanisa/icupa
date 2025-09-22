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

function badRequest(errors: string[]): Response {
  return new Response(JSON.stringify({ ok: false, errors }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}

function audit(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "permits.approve",
      fn: "permits-ops-approve",
      ...fields,
    }),
  );
}

async function fetchRequest(requestId: string) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/permits_requests_view?select=id,status,note&limit=1&id=eq.${requestId}`,
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
    const error = new Error(`Failed to load permits.requests: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    return null;
  }
  return rows[0] as { id: string; status: string; note: string | null };
}

async function approveRequest(requestId: string, note: string | null) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/approve_permit_request`,
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
        p_id: requestId,
        p_note: note ?? null,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to approve permits.requests: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("permits-ops-approve");
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST only" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const auth = await resolveAuth(req);
  if (!auth.isOps) {
    return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_error) {
    return badRequest(["Invalid JSON body"]);
  }

  const errors: string[] = [];
  const requestIdInput = typeof body?.request_id === "string"
    ? body.request_id
    : "";
  const noteInput = typeof body?.note === "string" ? body.note.trim() : "";

  if (!/^[0-9a-fA-F-]{36}$/.test(requestIdInput)) {
    errors.push("request_id must be a UUID");
  }
  if (noteInput.length > 500) {
    errors.push("note must be <= 500 characters");
  }

  if (errors.length > 0) {
    return badRequest(errors);
  }

  try {
    const existing = await fetchRequest(requestIdInput);
    if (!existing) {
      return new Response(
        JSON.stringify({ ok: false, error: "Request not found" }),
        {
          status: 404,
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (existing.status !== "pending") {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Only pending requests can be approved",
        }),
        {
          status: 409,
          headers: { "content-type": "application/json" },
        },
      );
    }

    const timestamp = new Date().toISOString();
    const actor = auth.actorLabel;
    const approvalNote = noteInput
      ? `${timestamp} - ${actor}: approved (${noteInput})`
      : `${timestamp} - ${actor}: approved`;

    await approveRequest(requestIdInput, approvalNote);

    audit({
      request_id: requestId,
      actor,
      target: requestIdInput,
      status: "approved",
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    audit({
      request_id: requestId,
      actor: auth.actorLabel,
      target: requestIdInput,
      status: "error",
    });
    const wrapped = error instanceof Error ? error : new Error(String(error));
    (wrapped as { code?: string }).code ??= ERROR_CODES.UNKNOWN;
    throw wrapped;
  }
}, { fn: "permits-ops-approve", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);
