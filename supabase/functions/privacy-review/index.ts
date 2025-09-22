import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import {
  callRpc,
  getAuthUser,
  getRequestRow,
  logPrivacyAudit,
} from "../_shared/privacy.ts";

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("privacy-review");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  const authUser = await getAuthUser(req);
  if (!authUser || authUser.id === "service-role") {
    // service role is allowed, but ensure headers present
    // no-op
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const requestIdInput = typeof body.request_id === "string"
    ? body.request_id.trim()
    : "";
  if (!isUuid(requestIdInput)) {
    return jsonResponse({ ok: false, error: "request_id must be UUID" }, 400);
  }

  const decision = typeof body.decision === "string"
    ? body.decision.trim().toLowerCase()
    : "";
  if (decision !== "approve" && decision !== "reject") {
    return jsonResponse({
      ok: false,
      error: "decision must be approve or reject",
    }, 400);
  }

  const note = typeof body.note === "string" ? body.note.slice(0, 500) : null;

  const row = await getRequestRow(requestIdInput);
  if (!row) {
    return jsonResponse({ ok: false, error: "request not found" }, 404);
  }

  if (row.status !== "received" && row.status !== "in_review") {
    return jsonResponse({ ok: false, error: "request already reviewed" }, 409);
  }

  const newStatus = decision === "approve" ? "approved" : "rejected";

  try {
    await callRpc("privacy_transition_request", {
      p_request_id: requestIdInput,
      p_allowed_from: null,
      p_new_status: newStatus,
      p_decision_note: note,
    });

    await logPrivacyAudit(authUser?.id ?? null, "privacy.review", {
      requestId: requestIdInput,
      decision: newStatus,
      requestRef: requestId,
    });

    console.log(JSON.stringify({
      level: "AUDIT",
      event: "privacy.review",
      fn: "privacy-review",
      requestId,
      review_for: anonymizeUuid(row.subject_user_id),
      decision: newStatus,
    }));

    return jsonResponse({ ok: true, status: newStatus });
  } catch (error) {
    console.log(JSON.stringify({
      level: "ERROR",
      event: "privacy.review.error",
      fn: "privacy-review",
      requestId,
      message: error instanceof Error ? error.message : String(error),
    }));
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}, { fn: "privacy-review", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/
    .test(value);
}

function anonymizeUuid(value: string): string {
  if (!isUuid(value)) return "anon";
  return `${value.slice(0, 8)}-xxxx`;
}
