// AUDIT: This mock function emits structured audit logs for offline analysis.
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

type RefundRequest = {
  itinerary_id: unknown;
  amount_cents: unknown;
  reason: unknown;
};

function toJson(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const actor = req.headers.get("authorization") ? "bearer" : "anonymous";
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("ops-refund");
  }

  if (req.method !== "POST") {
    logAudit({ requestId, actor, details: "method_not_allowed" });
    return toJson({ ok: false, error: "POST only" }, { status: 405 });
  }

  let payload: RefundRequest;
  try {
    payload = (await req.json()) as RefundRequest;
  } catch (_error) {
    logAudit({ requestId, actor, details: "invalid_json" });
    return toJson({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const errors: string[] = [];

  const itineraryId = typeof payload.itinerary_id === "string"
    ? payload.itinerary_id.trim()
    : "";
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(itineraryId)) {
    errors.push("itinerary_id must be a valid UUID");
  }

  if (
    typeof payload.amount_cents !== "number" ||
    !Number.isFinite(payload.amount_cents) || payload.amount_cents <= 0
  ) {
    errors.push("amount_cents must be a positive number");
  }

  if (typeof payload.reason !== "string") {
    errors.push("reason must be a string");
  } else {
    const trimmed = payload.reason.trim();
    if (trimmed.length === 0 || trimmed.length > 200) {
      errors.push("reason must be between 1 and 200 characters");
    }
  }

  if (errors.length > 0) {
    logAudit({ requestId, actor, details: "validation_error" });
    return toJson({ ok: false, errors }, { status: 400 });
  }

  const responseId = `mock-${requestId}`;

  logAudit({
    requestId,
    actor,
    details: "accepted",
    amount: payload.amount_cents,
  });

  return toJson({ ok: true, request_id: responseId });
}, { fn: "ops-refund", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function logAudit(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "ops.refund",
      fn: "ops-refund",
      ...fields,
    }),
  );
}
