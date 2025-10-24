import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { getSupabaseServiceConfig } from "../_shared/env.ts";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "supplier-match" });

interface SupplierMatchPayload {
  traveler_id?: unknown;
  travelerId?: unknown;
  embedding?: unknown;
  limit?: unknown;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("supplier-match");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  if (!authorize(req)) {
    return jsonResponse({ ok: false, error: "forbidden" }, 403);
  }

  let payload: SupplierMatchPayload;
  try {
    payload = (await req.json()) as SupplierMatchPayload;
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const travelerId = normalizeUuid(payload.traveler_id ?? payload.travelerId);
  const embedding = normalizeEmbedding(payload.embedding);
  const limit = normalizeLimit(payload.limit);

  if (!embedding && !travelerId) {
    return jsonResponse({ ok: false, error: "embedding_or_traveler_required" }, 400);
  }

  let supplierPromise: Promise<Response>;
  let travelerPromise: Promise<Response>;
  let source: "embedding" | "traveler";

  if (embedding) {
    supplierPromise = callRpc("match_suppliers_by_intent", {
      embedding,
      match_limit: limit,
    }, requestId);
    travelerPromise = callRpc("match_travelers_by_intent", {
      embedding,
      match_limit: limit,
    }, requestId);
    source = "embedding";
  } else {
    supplierPromise = callRpc("match_suppliers_for_traveler", {
      traveler_id: travelerId,
      match_limit: limit,
    }, requestId);
    travelerPromise = callRpc("match_travelers_for_traveler", {
      traveler_id: travelerId,
      match_limit: limit,
    }, requestId);
    source = "traveler";
  }

  const [supplierResponse, travelerResponse] = await Promise.all([
    supplierPromise,
    travelerPromise,
  ]);

  if (!supplierResponse.ok) {
    const text = await supplierResponse.text().catch(() => "");
    console.error("match_suppliers_failed", { status: supplierResponse.status, requestId, body: text });
    return jsonResponse({ ok: false, error: "supplier_match_failed", request_id: requestId }, 502);
  }

  if (!travelerResponse.ok) {
    const text = await travelerResponse.text().catch(() => "");
    console.error("match_travelers_failed", { status: travelerResponse.status, requestId, body: text });
    return jsonResponse({ ok: false, error: "traveler_match_failed", request_id: requestId }, 502);
  }

  const supplierRows = await supplierResponse.json().catch(() => []) as Array<Record<string, unknown>>;
  const travelerRows = await travelerResponse.json().catch(() => []) as Array<Record<string, unknown>>;

  return jsonResponse({
    ok: true,
    request_id: requestId,
    source,
    suppliers: supplierRows.map(normalizeSupplierMatch),
    travelers: travelerRows.map(normalizeTravelerMatch),
  });
}, { fn: "supplier-match", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function normalizeSupplierMatch(row: Record<string, unknown>) {
  const supplierId = typeof row.supplier_id === "string" ? row.supplier_id : null;
  const supplierName = typeof row.supplier_name === "string" ? row.supplier_name : null;
  const score = typeof row.score === "number" ? row.score : Number(row.score ?? 0);
  const metadata = typeof row.metadata === "object" && row.metadata !== null ? row.metadata : {};
  return { supplier_id: supplierId, supplier_name: supplierName, score: Number(score ?? 0), metadata };
}

function normalizeTravelerMatch(row: Record<string, unknown>) {
  const travelerId = typeof row.traveler_id === "string" ? row.traveler_id : null;
  const score = typeof row.score === "number" ? row.score : Number(row.score ?? 0);
  const metadata = typeof row.metadata === "object" && row.metadata !== null ? row.metadata : {};
  return { traveler_id: travelerId, score: Number(score ?? 0), metadata };
}

function normalizeUuid(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const value = input.trim();
  return /^[0-9a-fA-F-]{36}$/.test(value) ? value : undefined;
}

function normalizeEmbedding(input: unknown): number[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const values = input.map((value) => {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseFloat(value.trim());
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  });
  return values.length ? values : undefined;
}

function normalizeLimit(input: unknown): number {
  const parsed = typeof input === "number"
    ? Math.trunc(input)
    : typeof input === "string" && input.trim()
      ? Number.parseInt(input.trim(), 10)
      : 5;
  if (Number.isNaN(parsed) || parsed <= 0) return 5;
  return Math.min(Math.max(parsed, 1), 50);
}

function authorize(req: Request): boolean {
  const apiKey = req.headers.get("apikey") ?? req.headers.get("Apikey") ?? "";
  const bearer = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  return apiKey === SERVICE_ROLE_KEY || bearer === `Bearer ${SERVICE_ROLE_KEY}`;
}

async function callRpc(name: string, body: Record<string, unknown>, requestId: string): Promise<Response> {
  return await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "x-request-id": requestId,
    },
    body: JSON.stringify(body),
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
