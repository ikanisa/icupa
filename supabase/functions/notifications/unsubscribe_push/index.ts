import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Maybe<T> = T | null | undefined;

type UnsubscribeRequest = {
  subscription_id?: string;
  endpoint?: string;
  table_session_id?: string;
  location_id?: string;
  tenant_id?: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message } }, status);
}

function isUuid(value: Maybe<string>): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST requests are supported");
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase configuration for notifications/unsubscribe_push");
    return errorResponse(500, "config_missing", "Server configuration incomplete");
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return errorResponse(415, "unsupported_media_type", "Expected JSON payload");
  }

  let body: UnsubscribeRequest;
  try {
    body = (await req.json()) as UnsubscribeRequest;
  } catch (_error) {
    return errorResponse(400, "invalid_json", "Request body could not be parsed");
  }

  const subscriptionId = body.subscription_id ?? null;
  const endpoint = body.endpoint ?? null;

  if (subscriptionId && !isUuid(subscriptionId)) {
    return errorResponse(400, "invalid_subscription_id", "subscription_id must be a valid UUID");
  }

  if (!subscriptionId && !endpoint) {
    return errorResponse(
      400,
      "missing_identifier",
      "Either subscription_id or endpoint must be provided",
    );
  }

  const tableSessionId = body.table_session_id ?? null;
  if (tableSessionId && !isUuid(tableSessionId)) {
    return errorResponse(400, "invalid_table_session", "table_session_id must be a valid UUID");
  }

  const locationId = body.location_id ?? null;
  if (locationId && !isUuid(locationId)) {
    return errorResponse(400, "invalid_location", "location_id must be a valid UUID");
  }

  const tenantId = body.tenant_id ?? null;
  if (tenantId && !isUuid(tenantId)) {
    return errorResponse(400, "invalid_tenant", "tenant_id must be a valid UUID");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const deleteQuery = supabase
    .from("notification_subscriptions")
    .delete({ count: "exact" })
    .limit(1);

  if (subscriptionId) {
    deleteQuery.eq("id", subscriptionId);
  } else if (endpoint) {
    deleteQuery.eq("endpoint", endpoint);
  }

  if (tableSessionId) {
    deleteQuery.eq("table_session_id", tableSessionId);
  }

  if (locationId) {
    deleteQuery.eq("location_id", locationId);
  }

  if (tenantId) {
    deleteQuery.eq("tenant_id", tenantId);
  }

  const { error: deleteError, count } = await deleteQuery;

  if (deleteError) {
    console.error("Failed to remove push subscription", deleteError, {
      subscriptionId,
      endpoint,
    });
    return errorResponse(500, "subscription_delete_failed", "Could not delete subscription");
  }

  const status = count && count > 0 ? "deleted" : "not_found";

  return jsonResponse({ status, deleted: count ?? 0 });
});
