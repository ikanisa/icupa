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

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return { userId, isOps: false, actorLabel: userId };
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
      event: "permits.request",
      fn: "permits-request",
      ...fields,
    }),
  );
}

interface InsertArgs {
  userId: string | null;
  park: string;
  visitDate: string;
  paxCount: number;
  note: string | null;
}

async function insertRequest(args: InsertArgs) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/create_permit_request`,
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
        p_user: args.userId,
        p_park: args.park,
        p_visit: args.visitDate,
        p_pax: args.paxCount,
        p_note: args.note,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to insert permits.requests: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }

  const data = await response.json();
  if (!data?.id) {
    throw new Error("Unexpected response from create_permit_request");
  }
  return data;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("permits-request");
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST only" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const auth = await resolveAuth(req);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_error) {
    return badRequest(["Invalid JSON body"]);
  }

  const errors: string[] = [];
  const park = typeof body?.park === "string" ? body.park : "";
  const visitDate = typeof body?.visit_date === "string" ? body.visit_date : "";
  const paxCount = Number(body?.pax_count);
  const note = typeof body?.note === "string" ? body.note.trim() : undefined;

  if (!park || !["Volcanoes", "Nyungwe", "Akagera"].includes(park)) {
    errors.push("park must be Volcanoes|Nyungwe|Akagera");
  }

  if (
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(visitDate) ||
    Number.isNaN(new Date(visitDate).getTime())
  ) {
    errors.push("visit_date must be YYYY-MM-DD");
  }

  if (!Number.isInteger(paxCount) || paxCount <= 0) {
    errors.push("pax_count must be a positive integer");
  }

  if (note && note.length > 500) {
    errors.push("note must be <= 500 characters");
  }

  if (errors.length > 0) {
    return badRequest(errors);
  }

  try {
    const row = await insertRequest({
      userId: auth.userId,
      park,
      visitDate,
      paxCount,
      note: note ?? null,
    });

    audit({
      requestId,
      actor: auth.actorLabel,
      park,
      visit: visitDate,
      pax: paxCount,
      status: "pending",
    });

    return new Response(
      JSON.stringify({ ok: true, request_id: row.id, status: row.status }),
      { headers: { "content-type": "application/json" } },
    );
  } catch (error) {
    audit({ requestId, actor: auth.actorLabel, status: "error" });
    const wrapped = error instanceof Error ? error : new Error(String(error));
    (wrapped as { code?: string }).code ??= ERROR_CODES.UNKNOWN;
    throw wrapped;
  }
}, { fn: "permits-request", defaultErrorCode: ERROR_CODES.UNKNOWN });

serve(handler);
