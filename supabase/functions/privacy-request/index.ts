import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { callRpc, getAuthUser, logPrivacyAudit } from "../_shared/privacy.ts";

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("privacy-request");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const kind =
    (typeof body.kind === "string" ? body.kind.trim().toLowerCase() : "") as
      | "export"
      | "erasure"
      | "";
  if (kind !== "export" && kind !== "erasure") {
    return jsonResponse(
      { ok: false, error: "kind must be export or erasure" },
      400,
    );
  }

  const subjectUserId = typeof body.subject_user_id === "string"
    ? body.subject_user_id.trim()
    : "";
  if (!isUuid(subjectUserId)) {
    return jsonResponse(
      { ok: false, error: "subject_user_id must be a UUID" },
      400,
    );
  }

  const reason = typeof body.reason === "string"
    ? body.reason.slice(0, 500)
    : null;

  const authUser = await getAuthUser(req);
  const requesterUserId = authUser && authUser.id !== "service-role"
    ? authUser.id
    : null;

  if (requesterUserId && requesterUserId !== subjectUserId) {
    const error = new Error("subject_user_id must match caller");
    (error as { code?: string }).code = ERROR_CODES.AUTH_REQUIRED;
    throw error;
  }

  const inserted = await callRpc<{ id: string }>("privacy_create_request", {
    p_kind: kind,
    p_requester: requesterUserId,
    p_subject: subjectUserId,
    p_reason: reason,
  });

  await logPrivacyAudit(requesterUserId, "privacy.request", {
    requestId: inserted.id,
    kind,
    requestRef: requestId,
  });

  console.log(JSON.stringify({
    level: "AUDIT",
    event: "privacy.request",
    fn: "privacy-request",
    requestId,
    kind,
    requester: requesterUserId,
    subject: anonymizeUuid(subjectUserId),
  }));

  return jsonResponse({ ok: true, request_id: inserted.id });
}, { fn: "privacy-request", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/
    .test(
      value,
    );
}

function anonymizeUuid(value: string): string {
  if (!isUuid(value)) return "anon";
  return `${value.slice(0, 8)}-xxxx`;
}
