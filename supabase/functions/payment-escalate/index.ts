import fixtures from "./fixtures/escalations.json" assert { type: "json" };
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

type EscalationAction = {
  id: string;
  title: string;
  description: string;
  cta_label: string;
  cta_type: "retry_intent" | "open_url" | "contact_ops" | "copy_text";
  idempotency_hint?: string;
  wait_seconds?: number;
  href?: string;
  contact_channel?: string;
  text?: string;
};

type EscalationHealthCheck = {
  id: string;
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  last_checked?: string;
};

type EscalationFixture = {
  headline: string;
  summary: string;
  next_actions: EscalationAction[];
  health_checks: EscalationHealthCheck[];
};

const JSON_HEADERS = { "content-type": "application/json" } as const;

const ESCALATION_FIXTURES = fixtures as Record<string, EscalationFixture>;
const DEFAULT_FIXTURE = ESCALATION_FIXTURES.default ?? ESCALATION_FIXTURES["default"];

if (!DEFAULT_FIXTURE) {
  throw new Error("payment-escalate requires a default fixture");
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...init.headers,
    },
  });
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveFixture(code: string): EscalationFixture {
  return (
    ESCALATION_FIXTURES[code] ??
    ESCALATION_FIXTURES[code.toLowerCase()] ??
    DEFAULT_FIXTURE
  );
}

function mapActions(
  actions: EscalationAction[],
  context: { idempotencyKey: string },
): EscalationAction[] {
  return actions.map((action) => {
    const replacedHint = action.idempotency_hint
      ? action.idempotency_hint.replaceAll("{{idempotency_key}}", context.idempotencyKey)
      : undefined;
    const nextAction: EscalationAction = { ...action };
    if (replacedHint) {
      nextAction.idempotency_hint = replacedHint;
    } else if (!replacedHint && action.idempotency_hint === undefined) {
      delete nextAction.idempotency_hint;
    }
    return nextAction;
  });
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("payment-escalate");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed", request_id: requestId }, {
      status: 405,
      headers: { "x-request-id": requestId },
    });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json", request_id: requestId }, {
      status: 400,
      headers: { "x-request-id": requestId },
    });
  }

  const itineraryId = normalizeString(payload.itineraryId ?? payload.itinerary_id);
  const paymentId = normalizeString(payload.paymentId ?? payload.payment_id);
  const failureCode = normalizeString(payload.failureCode ?? payload.failure_code) || "unknown";
  const idempotencyKey = normalizeString(payload.idempotencyKey ?? payload.idempotency_key);

  if (!idempotencyKey) {
    return jsonResponse({
      ok: false,
      error: "missing_idempotency_key",
      request_id: requestId,
    }, {
      status: 400,
      headers: { "x-request-id": requestId },
    });
  }

  const fixture = resolveFixture(failureCode);
  const actions = mapActions(fixture.next_actions, { idempotencyKey });

  return jsonResponse({
    ok: true,
    request_id: requestId,
    headline: fixture.headline,
    summary: fixture.summary,
    failure_code: failureCode,
    itinerary_id: itineraryId || undefined,
    payment_id: paymentId || undefined,
    idempotency_key: idempotencyKey,
    next_actions: actions,
    health_checks: fixture.health_checks,
    source: "fixtures",
  }, {
    status: 200,
    headers: { "x-request-id": requestId },
  });
}, { fn: "payment-escalate", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);
