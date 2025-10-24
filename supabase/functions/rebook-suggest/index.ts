import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import {
  buildGetHeaders,
  buildGrowthHeaders,
  isGrowthAuthorized,
  logGrowthAuthFailure,
  resolveGrowthAuth,
  resolveGrowthConfig,
} from "../_shared/growth.ts";

interface RebookRequestBody {
  disruption_id?: unknown;
  itinerary_id?: unknown;
  idempotency_key?: unknown;
  consent?: unknown;
  suggestion?: unknown;
  metadata?: unknown;
}

interface SuggestionRow {
  id: string;
  disruption_id: string | null;
  itinerary_id: string | null;
  suggestion: Record<string, unknown>;
  status: string;
  idempotency_key: string | null;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("rebook-suggest");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  const auth = await resolveGrowthAuth(req);
  const authorized = isGrowthAuthorized(auth, { allowServiceRole: true });
  if (!authorized) {
    const status = auth.type === "anonymous" ? 401 : 403;
    logGrowthAuthFailure({
      fn: "rebook-suggest",
      requestId,
      auth,
      required: "service_role",
      status,
    });
    return jsonResponse({ ok: false, error: "unauthorized", request_id: requestId }, status);
  }

  let body: RebookRequestBody;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const disruptionId = typeof body.disruption_id === "string" ? body.disruption_id : undefined;
  const itineraryId = typeof body.itinerary_id === "string" ? body.itinerary_id : undefined;
  const idempotencyKey = typeof body.idempotency_key === "string" && body.idempotency_key.length > 0
    ? body.idempotency_key
    : undefined;
  const consent = body.consent === true;
  const suggestion = typeof body.suggestion === "object" && body.suggestion !== null
    ? body.suggestion as Record<string, unknown>
    : {};
  const metadata = typeof body.metadata === "object" && body.metadata !== null
    ? body.metadata
    : {};

  const errors: string[] = [];
  if (!idempotencyKey) errors.push("idempotency_key required");
  if (!consent) errors.push("consent required");
  if (!disruptionId && !itineraryId) errors.push("disruption_id or itinerary_id required");

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const growthConfig = resolveGrowthConfig({ offlineFlag: "GROWTH_REBOOK_OFFLINE" });

  if (growthConfig.offline) {
    logOfflineFallback({ requestId, disruptionId, itineraryId });
    return jsonResponse({
      ok: true,
      request_id: requestId,
      mode: "offline",
      suggestion: buildFixtureSuggestion(disruptionId, itineraryId),
    });
  }

  const existing = await lookupSuggestion(growthConfig, idempotencyKey);
  if (existing) {
    return jsonResponse({
      ok: true,
      request_id: requestId,
      reused: true,
      suggestion: existing,
    });
  }

  const insertResponse = await fetch(`${growthConfig.url}/rest/v1/rebook_suggestions`, {
    method: "POST",
    headers: buildGrowthHeaders("growth", growthConfig.serviceRoleKey),
    body: JSON.stringify({
      disruption_id: disruptionId ?? null,
      itinerary_id: itineraryId ?? null,
      suggestion: {
        ...suggestion,
        generated_at: new Date().toISOString(),
      },
      status: "ready",
      idempotency_key: idempotencyKey,
      metadata: {
        ...metadata as Record<string, unknown>,
        request_id: requestId,
      },
    }),
  });

  if (!insertResponse.ok) {
    const text = await insertResponse.text();
    const error = new Error(`Failed to create suggestion: ${text || insertResponse.statusText}`);
    (error as { code?: string }).code = insertResponse.status === 409
      ? ERROR_CODES.DATA_CONFLICT
      : ERROR_CODES.UNKNOWN;
    throw error;
  }

  const rows = await insertResponse.json() as SuggestionRow[];
  const suggestionRow = Array.isArray(rows) && rows.length > 0
    ? rows[0]
    : {
      id: crypto.randomUUID(),
      disruption_id: disruptionId ?? null,
      itinerary_id: itineraryId ?? null,
      suggestion: suggestion as Record<string, unknown>,
      status: "ready",
      idempotency_key: idempotencyKey,
    };

  if (disruptionId) {
    await markDisruptionNotified(growthConfig, disruptionId);
  }

  return jsonResponse({
    ok: true,
    request_id: requestId,
    suggestion: suggestionRow,
  });
}, { fn: "rebook-suggest", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

export { handler };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function logOfflineFallback(details: { requestId: string; disruptionId?: string; itineraryId?: string }) {
  console.log(JSON.stringify({
    level: "WARN",
    event: "rebook.offline_fallback",
    fn: "rebook-suggest",
    request_id: details.requestId,
    disruption_id: details.disruptionId,
    itinerary_id: details.itineraryId,
  }));
}

function buildFixtureSuggestion(disruptionId?: string, itineraryId?: string) {
  return {
    id: crypto.randomUUID(),
    disruption_id: disruptionId ?? null,
    itinerary_id: itineraryId ?? null,
    status: "ready",
    suggestion: {
      summary: "Offer complimentary rebooking on next available flight",
      options: [
        {
          carrier: "MockAir",
          flight: "EC202",
          departure: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          notes: "Includes lounge access and meal vouchers",
        },
      ],
    },
  };
}

async function lookupSuggestion(config: ReturnType<typeof resolveGrowthConfig>, idempotencyKey: string) {
  const params = new URLSearchParams();
  params.set("select", "id,disruption_id,itinerary_id,suggestion,status,idempotency_key");
  params.set("idempotency_key", `eq.${idempotencyKey}`);
  params.set("limit", "1");

  const response = await fetch(`${config.url}/rest/v1/rebook_suggestions?${params.toString()}`, {
    method: "GET",
    headers: buildGetHeaders("growth", config.serviceRoleKey),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to lookup suggestion: ${text || response.statusText}`);
    (error as { code?: string }).code = ERROR_CODES.UNKNOWN;
    throw error;
  }

  const rows = await response.json() as SuggestionRow[];
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function markDisruptionNotified(config: ReturnType<typeof resolveGrowthConfig>, disruptionId: string) {
  const response = await fetch(`${config.url}/rest/v1/disruption_board?id=eq.${disruptionId}`, {
    method: "PATCH",
    headers: {
      ...buildGrowthHeaders("growth", config.serviceRoleKey),
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      status: "notified",
      metadata: {
        updated_at: new Date().toISOString(),
      },
    }),
  });

  if (!response.ok) {
    console.log(JSON.stringify({
      level: "WARN",
      event: "rebook.disruption_patch_failed",
      fn: "rebook-suggest",
      disruption_id: disruptionId,
      status: response.status,
    }));
  }
}
