// AUDIT: This mock function emits structured audit logs for offline analysis.
import exceptionsFixture from "../../../ops/fixtures/exceptions.json" with {
  type: "json",
};
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

type ExceptionFixture = {
  id: string;
  type: string;
  status: string;
  supplier: string;
  last_error: string;
  occurred_at: string;
};

type ExceptionViewRow = {
  id: string;
  kind: string;
  status: string;
  last_error: string | null;
  created_at: string;
};

const VALID_STATUSES = new Set(["open", "retrying", "resolved"]);
const USE_FIXTURES = (Deno.env.get("USE_FIXTURES") ?? "0") === "1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const exceptions = (exceptionsFixture as ExceptionFixture[]).map((item) => ({
  ...item,
}));

function auditLog(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "ops.exceptions",
      fn: "ops-exceptions",
      ...fields,
    }),
  );
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

function filterFixtures(statusParam: string | null) {
  return statusParam
    ? exceptions.filter((item) => item.status.toLowerCase() === statusParam)
    : exceptions;
}

async function fetchViewData(
  statusParam: string | null,
): Promise<ExceptionFixture[]> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing for live view");
  }

  const params = new URLSearchParams();
  params.set("select", "id,kind,status,last_error,created_at");
  if (statusParam) {
    params.append("status", `eq.${statusParam}`);
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/ops.v_exceptions?${params.toString()}`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Prefer: "count=exact",
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to fetch ops.v_exceptions: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const data = (await response.json()) as ExceptionViewRow[];
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    type: row.kind,
    status: row.status,
    supplier: "",
    last_error: row.last_error ?? "",
    occurred_at: row.created_at,
  }));
}
Deno.serve(withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("ops-exceptions");
  }

  if (req.method !== "GET") {
    return toJson({ ok: false, error: "GET only" }, { status: 405 });
  }
  const statusParam = url.searchParams.get("status")?.toLowerCase() ?? null;

  if (statusParam && !VALID_STATUSES.has(statusParam)) {
    return toJson(
      {
        ok: false,
        error: "status must be one of open|retrying|resolved",
      },
      { status: 400 },
    );
  }

  try {
    if (USE_FIXTURES) {
      const filtered = filterFixtures(statusParam);
      auditLog({
        requestId,
        source: "fixtures",
        status: statusParam ?? "",
        results: filtered.length,
      });
      return toJson({ ok: true, data: filtered, request_id: requestId });
    }

    const rows = await fetchViewData(statusParam);
    auditLog({
      requestId,
      source: "view",
      status: statusParam ?? "",
      results: rows.length,
    });
    return toJson({ ok: true, data: rows, request_id: requestId });
  } catch (error) {
    auditLog({
      requestId,
      source: USE_FIXTURES ? "fixtures" : "view",
      status: "error",
    });
    const wrapped = error instanceof Error ? error : new Error(String(error));
    (wrapped as { code?: string }).code ??= ERROR_CODES.UNKNOWN;
    throw wrapped;
  }
}, { fn: "ops-exceptions", defaultErrorCode: ERROR_CODES.UNKNOWN }));
