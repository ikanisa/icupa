import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import {
  callRpc,
  getAuthUser,
  getRequestRow,
  logPrivacyAudit,
  signBucketObject,
  uploadJsonToBucket,
} from "../_shared/privacy.ts";

const EXPORT_BUCKET = "privacy_exports";

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("privacy-export");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  const authUser = await getAuthUser(req);
  if (!authUser || authUser.id === "service-role") {
    // service role access expected
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

  const row = await getRequestRow(requestIdInput);
  if (!row) {
    return jsonResponse({ ok: false, error: "request not found" }, 404);
  }

  if (row.kind !== "export") {
    return jsonResponse({ ok: false, error: "request is not an export" }, 400);
  }

  if (row.status !== "approved" && row.status !== "processing") {
    return jsonResponse({ ok: false, error: "request not approved" }, 409);
  }

  try {
    if (row.status === "approved") {
      await callRpc("privacy_set_status", {
        p_request_id: requestIdInput,
        p_status: "processing",
      });
    }

    const exportPayload = await callRpc<Record<string, unknown>>(
      "privacy_collect_export",
      { p_subject: row.subject_user_id },
    );

    const objectPath = `${requestIdInput}.json`;
    await uploadJsonToBucket(EXPORT_BUCKET, objectPath, exportPayload);
    const signedUrl = await signBucketObject(EXPORT_BUCKET, objectPath);

    await callRpc("privacy_set_status", {
      p_request_id: requestIdInput,
      p_status: "completed",
    });

    await logPrivacyAudit(authUser?.id ?? null, "privacy.export", {
      requestId: requestIdInput,
      requestRef: requestId,
    });

    console.log(JSON.stringify({
      level: "AUDIT",
      event: "privacy.export",
      fn: "privacy-export",
      requestId,
      request: requestIdInput,
      subject: anonymizeUuid(row.subject_user_id),
    }));

    return jsonResponse({
      ok: true,
      request_id: requestIdInput,
      signed_url: signedUrl,
    });
  } catch (error) {
    await callRpc("privacy_set_status", {
      p_request_id: requestIdInput,
      p_status: "failed",
    }).catch(() => undefined);

    console.log(JSON.stringify({
      level: "ERROR",
      event: "privacy.export.error",
      fn: "privacy-export",
      requestId,
      message: error instanceof Error ? error.message : String(error),
    }));

    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}, { fn: "privacy-export", defaultErrorCode: ERROR_CODES.UNKNOWN });

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
