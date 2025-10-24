import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import fixture from "../../../ops/fixtures/price_breakdown.json" assert { type: "json" };

type FixtureBreakdown = {
  option_id: string;
  currency: string;
  total_amount_cents: number;
  collected_amount_cents?: number;
  updated_at?: string;
  segments: Array<{
    id: string;
    label: string;
    amount_cents: number;
    category?: string;
    description?: string;
    tone?: string;
  }>;
  badges?: Array<{ id: string; label: string; tone?: string; description?: string }>;
  notes?: string[];
};

type RequestBody = {
  option_ids?: unknown;
  currency?: unknown;
};

const fixtureMap = new Map<string, FixtureBreakdown>();
for (const entry of (fixture.breakdowns ?? []) as FixtureBreakdown[]) {
  fixtureMap.set(entry.option_id, entry);
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("helpers-price");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const optionIds = Array.isArray(body.option_ids)
    ? body.option_ids.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  if (optionIds.length === 0) {
    const error = new Error("option_ids array with at least one entry is required");
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const normalizedCurrency = typeof body.currency === "string" && body.currency.trim()
    ? body.currency.trim().toUpperCase()
    : null;

  const breakdowns: Array<{ option_id: string; breakdown: FixtureBreakdown }> = [];
  const missing: string[] = [];

  for (const optionId of optionIds) {
    const found = fixtureMap.get(optionId) ?? fixtureMap.get("default");
    if (found) {
      const breakdown = normalizedCurrency
        ? { ...found, currency: normalizedCurrency }
        : found;
      breakdowns.push({ option_id: optionId, breakdown });
    } else {
      missing.push(optionId);
    }
  }

  logAudit({
    requestId,
    option_ids: optionIds,
    breakdowns: breakdowns.length,
    missing: missing.length,
  });

  return jsonResponse({
    ok: true,
    request_id: requestId,
    source: "fixture",
    breakdowns,
    missing,
  });
}, { fn: "helpers-price", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function logAudit(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "helpers.price.fixture",
      fn: "helpers-price",
      ...fields,
    }),
  );
}
