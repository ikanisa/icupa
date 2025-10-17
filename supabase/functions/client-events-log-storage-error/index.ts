import {
  createServiceRoleClient,
  errorResponse,
  jsonResponse,
  resolveSessionContext,
  startEdgeTrace,
} from "../_shared/payments.ts";

interface StorageErrorRequest {
  table_session_id?: string;
  tenant_id?: string | null;
  location_id?: string | null;
  key?: string;
  operation?: string;
  message?: string;
  storage?: string;
  quota_exceeded?: boolean;
}

export default async function handler(req: Request): Promise<Response> {
  const span = startEdgeTrace("client.events.log_storage_error");
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST requests are supported");
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return errorResponse(415, "unsupported_media_type", "Expected JSON payload");
  }

  const tableSessionId =
    req.headers.get("x-icupa-session") ?? req.headers.get("x-ICUPA-session") ?? "";
  if (!tableSessionId) {
    return errorResponse(401, "missing_session", "x-icupa-session header is required");
  }

  const payload = (await req.json()) as StorageErrorRequest;
  const normalizedOperation = (payload.operation ?? "").toLowerCase();
  if (!payload.key || !normalizedOperation) {
    return errorResponse(400, "invalid_payload", "key and operation are required");
  }

  const client = createServiceRoleClient();

  try {
    const context = await resolveSessionContext(client, tableSessionId);

    await client.from("events").insert({
      tenant_id: context.tenantId ?? payload.tenant_id ?? null,
      location_id: context.locationId ?? payload.location_id ?? null,
      table_session_id: context.tableSessionId,
      type: "client.storage_error",
      payload: {
        key: payload.key,
        operation: normalizedOperation,
        message: payload.message ?? null,
        storage: payload.storage ?? "localStorage",
        quota_exceeded: payload.quota_exceeded ?? false,
        user_agent: req.headers.get("user-agent") ?? null,
        reported_at: new Date().toISOString(),
      },
    });

    await span.end(client, {
      status: "success",
      tenantId: context.tenantId,
      locationId: context.locationId,
      tableSessionId: context.tableSessionId,
      attributes: {
        operation: normalizedOperation,
      },
    });

    return jsonResponse({ status: "logged" }, 201);
  } catch (error) {
    console.error("Failed to persist client storage error", error);
    await span.end(client, {
      status: "error",
      tenantId: payload.tenant_id ?? null,
      locationId: payload.location_id ?? null,
      tableSessionId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(500, "storage_error_logging_failed", "Failed to log storage error event");
  }
}
