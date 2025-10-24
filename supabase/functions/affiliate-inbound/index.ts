import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import {
  fetchAffiliatePartner,
  insertAffiliateEvent,
  verifyAffiliateSignature,
} from "../_shared/affiliate.ts";

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("affiliate-inbound");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST required" }, 405);
  }

  const partnerHeader = sanitize(req.headers.get("x-eco-affiliate-partner"));
  const signatureHeader = sanitize(req.headers.get("x-eco-affiliate-signature"));
  const timestampHeader = sanitize(req.headers.get("x-eco-affiliate-timestamp"));

  const rawBody = await req.text();
  const parsedPayload = parseJson(rawBody);
  const eventType = detectEventType(parsedPayload);

  let partner = null;
  try {
    partner = partnerHeader ? await fetchAffiliatePartner(partnerHeader) : null;
  } catch (error) {
    console.error("affiliate-inbound.partner_load_error", error);
    return jsonResponse({ ok: false, error: "partner_lookup_failed", request_id: requestId }, 502);
  }

  const signature = await verifyAffiliateSignature({
    header: signatureHeader,
    timestampHeader,
    secret: partner?.signing_secret ?? null,
    payload: rawBody,
  });

  const partnerSlug = partnerHeader ?? partner?.slug ?? "unmatched";

  const metadata = {
    request_id: requestId,
    partner_found: Boolean(partner),
    partner_slug: partnerSlug,
    event_type: eventType,
  };

  const eventRow = await insertAffiliateEvent({
    partner,
    partnerSlug,
    direction: "inbound",
    eventType,
    requestId,
    signature,
    rawBody,
    payload: parsedPayload ?? rawBody,
    headers: {
      "x-eco-affiliate-partner": partnerHeader,
      "x-eco-affiliate-signature": signatureHeader,
      "x-eco-affiliate-timestamp": timestampHeader,
      "content-type": req.headers.get("content-type"),
      "user-agent": req.headers.get("user-agent"),
    },
    metadata,
  });

  console.log(JSON.stringify({
    level: "INFO",
    event: "affiliate.inbound",
    fn: "affiliate-inbound",
    requestId,
    partner: partnerSlug,
    eventType,
    signatureStatus: signature.status,
  }));

  const body = {
    ok: signature.status === "valid",
    request_id: requestId,
    event_id: eventRow.id,
    signature_status: signature.status,
  } as Record<string, unknown>;

  if (!partner) {
    body.error = "unknown_partner";
  } else if (signature.error) {
    body.error = signature.error;
  }

  return jsonResponse(body);
}, { fn: "affiliate-inbound", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function sanitize(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseJson(body: string): unknown {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch (_error) {
    return null;
  }
}

function detectEventType(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["event", "type", "kind", "action"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }
  }
  return "affiliate.event";
}
