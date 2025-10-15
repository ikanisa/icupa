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

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

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

function parsePageParam(raw: string | null): number {
  if (!raw) return 1;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function parsePageSizeParam(raw: string | null): number {
  if (!raw) return DEFAULT_PAGE_SIZE;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_PAGE_SIZE;
  const normalized = Math.floor(parsed);
  return Math.min(MAX_PAGE_SIZE, Math.max(1, normalized));
}

function parseContentRangeTotal(header: string | null): number | null {
  if (!header) return null;
  const match = /\/(\d+)$/u.exec(header.trim());
  if (!match) return null;
  const total = Number(match[1]);
  if (!Number.isFinite(total) || total < 0) return null;
  return Math.floor(total);
}

async function fetchViewData(
  statusParam: string | null,
  page: number,
  pageSize: number,
): Promise<{ rows: ExceptionFixture[]; total: number }> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing for live view");
  }

  const params = new URLSearchParams();
  params.set("select", "id,kind,status,last_error,created_at");
  if (statusParam) {
    params.append("status", `eq.${statusParam}`);
  }

  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/ops.v_exceptions?${params.toString()}`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Prefer: "count=exact",
        Range: `${start}-${end}`,
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
  const rows = (Array.isArray(data) ? data : []).map((row) => ({
    id: row.id,
    type: row.kind,
    status: row.status,
    supplier: "",
    last_error: row.last_error ?? "",
    occurred_at: row.created_at,
  }));
  const totalHeader = response.headers.get("content-range");
  const total = parseContentRangeTotal(totalHeader);
  const normalizedTotal = typeof total === "number" ? total : Math.max(rows.length + start, rows.length);
  return { rows, total: normalizedTotal };
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
  const page = parsePageParam(url.searchParams.get("page"));
  const pageSize = parsePageSizeParam(url.searchParams.get("page_size"));

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
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const paged = filtered.slice(start, start + pageSize);
      auditLog({
        requestId,
        source: "fixtures",
        status: statusParam ?? "",
        page,
        pageSize,
        total,
        results: paged.length,
      });
      return toJson({
        ok: true,
        data: paged,
        request_id: requestId,
        total,
        page,
        page_size: pageSize,
      });
    }

    const { rows, total } = await fetchViewData(statusParam, page, pageSize);
    auditLog({
      requestId,
      source: "view",
      status: statusParam ?? "",
      page,
      pageSize,
      total,
      results: rows.length,
    });
    return toJson({
      ok: true,
      data: rows,
      request_id: requestId,
      total,
      page,
      page_size: pageSize,
    });
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
