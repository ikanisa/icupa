import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Maybe<T> = T | null | undefined;

type PushSubscriptionKeys = {
  auth?: string;
  p256dh?: string;
};

type PushSubscriptionJson = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: PushSubscriptionKeys;
};

type SubscribeRequest = {
  subscription?: PushSubscriptionJson;
  table_session_id?: string;
  location_id?: string;
  tenant_id?: string;
  profile_id?: string;
  locale?: string;
};

interface TableSessionRow {
  table_id?: string | null;
}

interface TableRow {
  location_id?: string | null;
}

interface LocationRow {
  tenant_id?: string | null;
}

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

function extractLocale(requestLocale: Maybe<string>, headerLocale: Maybe<string>): string | null {
  if (requestLocale && requestLocale.length > 0) {
    return requestLocale;
  }
  if (headerLocale && headerLocale.length > 0) {
    return headerLocale.split(",")[0]?.trim() ?? null;
  }
  return null;
}

function sanitizeUserAgent(userAgent: Maybe<string>): string | null {
  if (!userAgent) return null;
  return userAgent.slice(0, 512);
}

async function resolveLocationAndTenant(
  supabase: ReturnType<typeof createClient>,
  tableSessionId: string | null,
  locationIdFromRequest: string | null,
  tenantIdFromRequest: string | null,
): Promise<{ locationId: string | null; tenantId: string | null }> {
  let locationId = locationIdFromRequest;
  let tenantId = tenantIdFromRequest;

  if (!locationId && tableSessionId) {
    const { data: sessionRow, error: sessionError } = await supabase
      .from("table_sessions")
      .select("table_id")
      .eq("id", tableSessionId)
      .maybeSingle<TableSessionRow>();

    if (sessionError) {
      console.error("Failed to resolve table session for push subscription", sessionError, {
        tableSessionId,
      });
    } else {
      const tableId = sessionRow?.table_id ?? null;
      if (tableId) {
        const { data: tableRow, error: tableError } = await supabase
          .from("tables")
          .select("location_id")
          .eq("id", tableId)
          .maybeSingle<TableRow>();
        if (tableError) {
          console.error("Failed to resolve table location for push subscription", tableError, {
            tableId,
          });
        } else {
          locationId = tableRow?.location_id ?? locationId;
        }
      }
    }
  }

  if (!tenantId && locationId) {
    const { data: locationRow, error: locationError } = await supabase
      .from("locations")
      .select("tenant_id")
      .eq("id", locationId)
      .maybeSingle<LocationRow>();

    if (locationError) {
      console.error("Failed to resolve tenant for push subscription", locationError, {
        locationId,
      });
    } else {
      tenantId = locationRow?.tenant_id ?? tenantId;
    }
  }

  return { locationId: locationId ?? null, tenantId: tenantId ?? null };
}

serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST requests are supported");
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase configuration for notifications/subscribe_push");
    return errorResponse(500, "config_missing", "Server configuration incomplete");
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return errorResponse(415, "unsupported_media_type", "Expected JSON payload");
  }

  let body: SubscribeRequest;
  try {
    body = (await req.json()) as SubscribeRequest;
  } catch (_error) {
    return errorResponse(400, "invalid_json", "Request body could not be parsed");
  }

  const subscription = body.subscription;
  const endpoint = subscription?.endpoint ?? null;
  const keys = subscription?.keys ?? {};
  const auth = keys?.auth ?? null;
  const p256dh = keys?.p256dh ?? null;

  if (!endpoint || !auth || !p256dh) {
    return errorResponse(
      400,
      "invalid_subscription",
      "Subscription endpoint and keys must be provided",
    );
  }

  const tableSessionId = body.table_session_id ?? null;
  if (tableSessionId && !isUuid(tableSessionId)) {
    return errorResponse(400, "invalid_table_session", "table_session_id must be a valid UUID");
  }

  const locationIdFromRequest = body.location_id ?? null;
  if (locationIdFromRequest && !isUuid(locationIdFromRequest)) {
    return errorResponse(400, "invalid_location", "location_id must be a valid UUID");
  }

  const tenantIdFromRequest = body.tenant_id ?? null;
  if (tenantIdFromRequest && !isUuid(tenantIdFromRequest)) {
    return errorResponse(400, "invalid_tenant", "tenant_id must be a valid UUID");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { locationId, tenantId } = await resolveLocationAndTenant(
    supabase,
    tableSessionId,
    locationIdFromRequest,
    tenantIdFromRequest,
  );

  const locale = extractLocale(body.locale ?? null, req.headers.get("accept-language"));
  const userAgent = sanitizeUserAgent(req.headers.get("user-agent"));

  const nowIso = new Date().toISOString();
  const payload = {
    tenant_id: tenantId,
    location_id: locationId,
    table_session_id: tableSessionId,
    profile_id: body.profile_id ?? null,
    endpoint,
    auth,
    p256dh,
    subscription,
    locale,
    user_agent: userAgent,
    last_seen_at: nowIso,
    updated_at: nowIso,
  };

  const { data: existingRow, error: existingError } = await supabase
    .from("notification_subscriptions")
    .select("id")
    .eq("endpoint", endpoint)
    .maybeSingle<{ id: string }>();

  if (existingError) {
    console.error("Failed to lookup existing push subscription", existingError, { endpoint });
    return errorResponse(500, "subscription_lookup_failed", "Could not upsert subscription");
  }

  let subscriptionId: string | null = existingRow?.id ?? null;
  if (subscriptionId) {
    const { error: updateError } = await supabase
      .from("notification_subscriptions")
      .update(payload)
      .eq("id", subscriptionId);

    if (updateError) {
      console.error("Failed to update push subscription", updateError, { subscriptionId });
      return errorResponse(500, "subscription_update_failed", "Could not update subscription");
    }

    return jsonResponse({ subscription_id: subscriptionId, status: "updated" });
  }

  const { data: insertedRow, error: insertError } = await supabase
    .from("notification_subscriptions")
    .insert(payload)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (insertError) {
    console.error("Failed to store push subscription", insertError, { endpoint });
    return errorResponse(500, "subscription_insert_failed", "Could not store subscription");
  }

  subscriptionId = insertedRow?.id ?? null;

  return jsonResponse({ subscription_id: subscriptionId, status: "created" }, 201);
});
