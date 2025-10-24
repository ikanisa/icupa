import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

type RefundPolicyRequest = {
  itinerary_id?: unknown;
  policy_text?: unknown;
};

type RiskLevel = "low" | "medium" | "high";

const handler = withObs(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("refund-policy-summarize");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const requestId = getRequestId(req) ?? crypto.randomUUID();

  let payload: RefundPolicyRequest;
  try {
    payload = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json", request_id: requestId }, 400);
  }

  const itineraryId = typeof payload.itinerary_id === "string" ? payload.itinerary_id.trim() : "";
  if (!isUuid(itineraryId)) {
    return jsonResponse({ ok: false, error: "invalid_itinerary_id", request_id: requestId }, 400);
  }

  const policyText = typeof payload.policy_text === "string" ? payload.policy_text.trim() : "";
  const risk = evaluateRisk(policyText);
  const summary = buildSummary(itineraryId, policyText, risk);
  const idempotencyKey = getIdempotencyKey(req);

  return jsonResponse({
    ok: true,
    request_id: idempotencyKey ?? requestId,
    summary,
  });
}, { fn: "refund-policy-summarize" });

Deno.serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function getIdempotencyKey(req: Request): string | undefined {
  return req.headers.get("idempotency-key") ?? req.headers.get("x-idempotency-key") ?? undefined;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function evaluateRisk(policy: string): RiskLevel {
  const text = policy.toLowerCase();
  if (text.includes("non-refundable") || text.includes("non refundable")) {
    return "high";
  }
  if (text.includes("partial refund") || text.includes("50%")) {
    return "medium";
  }
  return "low";
}

function buildSummary(itineraryId: string, policy: string, risk: RiskLevel) {
  const highlightBase = [
    {
      text: "Full refund available when cancelled 7+ days before departure.",
      risk: "low" as RiskLevel,
    },
    {
      text: "Within 7 days a finance supervisor must approve any partial refund.",
      risk: "medium" as RiskLevel,
    },
    {
      text: "Inside 48 hours escalate to force-majeure playbook before committing funds.",
      risk: "high" as RiskLevel,
    },
  ];

  const contextualHighlights = highlightBase.map((item) => ({
    ...item,
    risk: item.risk,
  }));

  const actions = [
    "Capture customer acknowledgement in CRM before triggering payouts.",
    "Update ledger note with policy summary and attach supporting docs.",
  ];

  const context = policy
    ? `Analyzed ${policy.split(/\s+/).filter(Boolean).length} words from provided policy snippet.`
    : "Using canned marketplace policy heuristics until vendor text is ingested.";

  return {
    title: "Refund policy assessment",
    risk_grade: risk,
    context: `${context} Itinerary ${itineraryId.slice(0, 8)}••• evaluated for manual override considerations.`,
    highlights: contextualHighlights,
    actions,
    generated_at: new Date().toISOString(),
  };
}
