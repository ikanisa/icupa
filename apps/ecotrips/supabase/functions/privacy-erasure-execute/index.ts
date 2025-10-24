import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import {
  callRpc,
  getAuthUser,
  getRequestRow,
  logPrivacyAudit,
  removeBucketObject,
} from "../_shared/privacy.ts";

const EXPORT_BUCKET = "privacy_exports";
const PLAN_BUCKET = "privacy_plans";
const INVOICE_BUCKET = "invoices";

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("privacy-erasure-execute");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  const authUser = await getAuthUser(req);
  if (!authUser) {
    throw Object.assign(new Error("unauthorized"), {
      code: ERROR_CODES.AUTH_REQUIRED,
    });
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

  const confirm = typeof body.confirm === "string"
    ? body.confirm.trim().toUpperCase()
    : "";
  if (confirm !== "ERASE") {
    return jsonResponse({ ok: false, error: "confirm must be ERASE" }, 400);
  }

  const row = await getRequestRow(requestIdInput);
  if (!row) {
    return jsonResponse({ ok: false, error: "request not found" }, 404);
  }

  if (row.kind !== "erasure") {
    return jsonResponse({ ok: false, error: "request is not an erasure" }, 400);
  }

  if (row.status !== "processing") {
    return jsonResponse(
      { ok: false, error: "request must be processing" },
      409,
    );
  }

  try {
    const invoiceRows = await callRpc<Array<Record<string, unknown>>>(
      "privacy_fetch_table",
      { p_schema: "fin", p_table: "invoices", p_subject: row.subject_user_id },
    ).catch(() => []);

    const invoiceNumbers = (invoiceRows ?? [])
      .map((record) =>
        typeof record?.number === "string" ? record.number : null
      )
      .filter((value): value is string => Boolean(value));

    const summary = await callRpc<
      Record<string, { schema: string; action: string; count: number }>
    >(
      "privacy_apply_erasure",
      { p_subject: row.subject_user_id },
    );

    await removeBucketObject(EXPORT_BUCKET, `${requestIdInput}.json`).catch(
      () => undefined,
    );
    await removeBucketObject(PLAN_BUCKET, `${requestIdInput}_plan.json`).catch(
      () => undefined,
    );

    await Promise.allSettled(
      invoiceNumbers.map((number) =>
        removeBucketObject(INVOICE_BUCKET, `${number}.html`)
      ),
    );

    await callRpc("privacy_set_status", {
      p_request_id: requestIdInput,
      p_status: "completed",
    });

    await logPrivacyAudit(authUser.id, "privacy.erasure", {
      requestId: requestIdInput,
      requestRef: requestId,
      summary,
    });

    console.log(JSON.stringify({
      level: "AUDIT",
      event: "privacy.erasure.execute",
      fn: "privacy-erasure-execute",
      requestId,
      request: requestIdInput,
      tables: summarize(summary),
    }));

    return jsonResponse({
      ok: true,
      request_id: requestIdInput,
      summary: summarize(summary),
    });
  } catch (error) {
    await callRpc("privacy_set_status", {
      p_request_id: requestIdInput,
      p_status: "failed",
    }).catch(() => undefined);

    console.log(JSON.stringify({
      level: "ERROR",
      event: "privacy.erasure.execute.error",
      fn: "privacy-erasure-execute",
      requestId,
      message: error instanceof Error ? error.message : String(error),
    }));

    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}, { fn: "privacy-erasure-execute", defaultErrorCode: ERROR_CODES.UNKNOWN });

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

function summarize(
  plan: Record<string, { schema: string; action: string; count: number }>,
): Array<{
  table: string;
  schema: string;
  action: string;
  count: number;
}> {
  return Object.entries(plan ?? {}).map(([table, details]) => ({
    table,
    schema: details.schema,
    action: details.action,
    count: Number(details.count ?? 0),
  }));
}
