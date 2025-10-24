import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

type PIIScanRequest = {
  label?: unknown;
  content?: unknown;
};

type FindingType = "email" | "phone" | "id" | "payment" | "note";

type Finding = {
  type: FindingType;
  value: string;
  index: number;
  context?: string;
};

const handler = withObs(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("privacy-pii-scan");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const requestId = getRequestId(req) ?? crypto.randomUUID();

  let payload: PIIScanRequest;
  try {
    payload = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json", request_id: requestId }, 400);
  }

  const content = typeof payload.content === "string" ? payload.content : "";
  if (!content.trim()) {
    return jsonResponse({ ok: false, error: "content_required", request_id: requestId }, 400);
  }

  const label = typeof payload.label === "string" ? payload.label.trim() : undefined;
  const findings = scanContent(content);
  const riskScore = calculateRisk(findings);
  const summary = buildSummary(findings, riskScore);
  const idempotencyKey = getIdempotencyKey(req);

  return jsonResponse({
    ok: true,
    request_id: idempotencyKey ?? requestId,
    findings,
    risk_score: Number(riskScore.toFixed(2)),
    summary,
    label,
  });
}, { fn: "privacy-pii-scan" });

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

function scanContent(content: string): Finding[] {
  const findings: Finding[] = [];

  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  for (const match of content.matchAll(emailRegex)) {
    findings.push({
      type: "email",
      value: match[0],
      index: match.index ?? 0,
      context: extractContext(content, match.index ?? 0, match[0].length),
    });
  }

  const phoneRegex = /(?:\+\d{1,3}[ -]?)?(?:\(?\d{2,3}\)?[ -]?){2,4}\d{2,4}/g;
  for (const match of content.matchAll(phoneRegex)) {
    const digits = match[0].replace(/[^\d]/g, "");
    if (digits.length < 7 || digits.length > 15) continue;
    findings.push({
      type: "phone",
      value: match[0],
      index: match.index ?? 0,
      context: extractContext(content, match.index ?? 0, match[0].length),
    });
  }

  const idRegex = /(passport|national id|nid|id number|license)\s*[#:]*\s*([A-Z0-9-]{4,})/gi;
  for (const match of content.matchAll(idRegex)) {
    findings.push({
      type: "id",
      value: `${match[1]} ${match[2]}`.trim(),
      index: match.index ?? 0,
      context: extractContext(content, match.index ?? 0, match[0].length),
    });
  }

  const paymentRegex = /(card|visa|mastercard|amex|mpesa)\s*(?:ending|number|token|ref)?\s*[:#-]?\s*[0-9xX]{4,}/gi;
  for (const match of content.matchAll(paymentRegex)) {
    findings.push({
      type: "payment",
      value: match[0].trim(),
      index: match.index ?? 0,
      context: extractContext(content, match.index ?? 0, match[0].length),
    });
  }

  if (findings.length === 0 && content.length > 200) {
    const snippet = content.slice(0, 120).replace(/\s+/g, " ").trim();
    findings.push({
      type: "note",
      value: snippet,
      index: 0,
      context: "No direct matches; review note manually.",
    });
  }

  return findings.slice(0, 25);
}

function extractContext(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 32);
  const end = Math.min(text.length, index + length + 32);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function calculateRisk(findings: Finding[]): number {
  const weights: Record<FindingType, number> = {
    email: 0.2,
    phone: 0.2,
    id: 0.35,
    payment: 0.4,
    note: 0.1,
  };
  const score = findings.reduce((acc, finding) => acc + (weights[finding.type] ?? 0.1), 0);
  return Math.min(1, score);
}

function buildSummary(findings: Finding[], risk: number): string {
  if (findings.length === 0) {
    return "No obvious PII detected; keep manual validation in place.";
  }
  const types = Array.from(new Set(findings.map((finding) => finding.type))).join(", ");
  return `${findings.length} potential indicators (${types}) with residual risk ${risk.toFixed(2)}.`;
}
