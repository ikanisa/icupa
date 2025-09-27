import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface PaymentCartModifier {
  name: string;
  price_cents: number;
}

export interface PaymentCartItem {
  id: string;
  name: string;
  quantity: number;
  unit_price_cents: number;
  modifiers?: PaymentCartModifier[];
}

export interface PaymentTotalsInput {
  tip_cents?: number;
  tax_cents?: number;
  service_cents?: number;
  expected_subtotal_cents?: number;
  expected_total_cents?: number;
}

export interface CalculatedTotals {
  subtotalCents: number;
  taxCents: number;
  serviceCents: number;
  tipCents: number;
  totalCents: number;
}

export interface SessionContext {
  tableSessionId: string;
  tableId: string;
  locationId: string;
  tenantId: string;
  currency: string;
}

export type PaymentMethod = "stripe" | "adyen" | "mtn_momo" | "airtel_money";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SUPABASE_FUNCTIONS_URL = (() => {
  const explicit = Deno.env.get("SUPABASE_FUNCTIONS_URL");
  if (explicit) {
    let normalized = explicit;
    while (normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  if (!SUPABASE_URL) {
    return null;
  }

  try {
    const parsed = new URL(SUPABASE_URL);
    if (parsed.hostname.endsWith(".supabase.co")) {
      const host = parsed.hostname.replace(".supabase.co", ".functions.supabase.co");
      return `${parsed.protocol}//${host}`;
    }
    return parsed.origin;
  } catch (_error) {
    return null;
  }
})();

const RECEIPTS_WORKER_PATH = SUPABASE_FUNCTIONS_URL
  ? `${SUPABASE_FUNCTIONS_URL}/functions/v1/receipts/process_queue`
  : null;

async function triggerReceiptsWorker(orderId: string, paymentId: string): Promise<void> {
  if (!RECEIPTS_WORKER_PATH || !SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  try {
    const response = await fetch(RECEIPTS_WORKER_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ reason: "payment_captured", order_id: orderId, payment_id: paymentId }),
    });

    if (!response.ok) {
      console.error("Receipt worker returned non-ok status", {
        status: response.status,
        statusText: response.statusText,
        orderId,
        paymentId,
      });
    }
  } catch (error) {
    console.error("Failed to trigger receipt worker", error, { orderId, paymentId });
  }
}

export function createServiceRoleClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service role credentials are not configured");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message } }, status);
}

function generateTraceId(): string {
  return (crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')).slice(0, 32);
}

function generateSpanId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

export function startEdgeTrace(name: string) {
  const traceId = generateTraceId();
  const spanId = generateSpanId();
  const start = performance.now();
  const startedAt = new Date().toISOString();

  return {
    traceId,
    spanId,
    async end(client: SupabaseClient, params: {
      status: 'success' | 'error';
      tenantId?: string | null;
      locationId?: string | null;
      tableSessionId?: string | null;
      attributes?: Record<string, unknown>;
      errorMessage?: string;
    }) {
      const durationMs = Math.round(performance.now() - start);
      try {
        await client.from('events').insert({
          tenant_id: params.tenantId ?? null,
          location_id: params.locationId ?? null,
          table_session_id: params.tableSessionId ?? null,
          type: 'observability.trace',
          payload: {
            name,
            trace_id: traceId,
            span_id: spanId,
            status: params.status,
            started_at: startedAt,
            duration_ms: durationMs,
            error: params.errorMessage ?? null,
            attributes: params.attributes ?? {},
          },
        });
      } catch (error) {
        console.error('Failed to record trace event', error, { name, traceId });
      }
    },
  };
}

export async function recordWebhookEvent(
  client: SupabaseClient,
  provider: string,
  eventId: string,
  payload: Record<string, unknown>,
  signature?: string | null,
): Promise<{ alreadyProcessed: boolean }> {
  const insertResult = await client
    .from("payment_webhook_events")
    .insert({
      provider,
      event_id: eventId,
      payload,
      signature: signature ?? null,
    })
    .select("id")
    .single();

  if (insertResult.error) {
    const code = (insertResult.error as { code?: string }).code;
    if (code === "23505") {
      return { alreadyProcessed: true };
    }
    throw new Error(`Failed to record webhook event: ${insertResult.error.message}`);
  }

  return { alreadyProcessed: false };
}

export async function markWebhookEventStatus(
  client: SupabaseClient,
  provider: string,
  eventId: string,
  status: string,
): Promise<void> {
  const { error } = await client
    .from("payment_webhook_events")
    .update({ last_status: status, processed_at: new Date().toISOString() })
    .eq("provider", provider)
    .eq("event_id", eventId);

  if (error) {
    console.error("Failed to update webhook status", error, { provider, eventId, status });
  }
}

export function calculateTotals(
  items: PaymentCartItem[],
  totals: PaymentTotalsInput
): CalculatedTotals {
  const subtotal = items.reduce((sum, item) => {
    if (!item || typeof item.quantity !== "number" || item.quantity <= 0) {
      return sum;
    }
    const modifierDelta = (item.modifiers ?? []).reduce((modSum, modifier) => {
      if (!modifier) {
        return modSum;
      }
      const value = Number(modifier.price_cents ?? 0);
      return modSum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const unitPrice = Number(item.unit_price_cents ?? 0) + modifierDelta;
    const quantity = Math.floor(item.quantity);
    return sum + Math.max(unitPrice, 0) * Math.max(quantity, 0);
  }, 0);

  const tip = Math.max(0, Math.floor(totals.tip_cents ?? 0));
  const tax = Math.max(0, Math.floor(totals.tax_cents ?? 0));
  const service = Math.max(0, Math.floor(totals.service_cents ?? 0));
  const computedTotal = subtotal + tip + tax + service;

  if (
    typeof totals.expected_subtotal_cents === "number" &&
    Math.abs(subtotal - totals.expected_subtotal_cents) > 5
  ) {
    throw new Error("Cart subtotal failed validation");
  }

  if (
    typeof totals.expected_total_cents === "number" &&
    Math.abs(computedTotal - totals.expected_total_cents) > 5
  ) {
    throw new Error("Cart total failed validation");
  }

  return {
    subtotalCents: subtotal,
    tipCents: tip,
    taxCents: tax,
    serviceCents: service,
    totalCents: computedTotal,
  } satisfies CalculatedTotals;
}

export async function resolveSessionContext(
  client: SupabaseClient,
  tableSessionId: string
): Promise<SessionContext> {
  const sessionResult = await client
    .from("table_sessions")
    .select("id, table_id, expires_at")
    .eq("id", tableSessionId)
    .maybeSingle();

  if (sessionResult.error) {
    throw new Error(`Unable to load table session: ${sessionResult.error.message}`);
  }
  if (!sessionResult.data) {
    throw new Error("Table session not found");
  }

  const expiresAt = new Date(sessionResult.data.expires_at ?? "");
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    throw new Error("Table session is no longer active");
  }

  const tableResult = await client
    .from("tables")
    .select("id, location_id")
    .eq("id", sessionResult.data.table_id)
    .maybeSingle();

  if (tableResult.error) {
    throw new Error(`Unable to load table metadata: ${tableResult.error.message}`);
  }
  if (!tableResult.data) {
    throw new Error("Linked table could not be found");
  }

  const locationResult = await client
    .from("locations")
    .select("id, tenant_id, currency")
    .eq("id", tableResult.data.location_id)
    .maybeSingle();

  if (locationResult.error) {
    throw new Error(`Unable to load location metadata: ${locationResult.error.message}`);
  }
  if (!locationResult.data) {
    throw new Error("Location metadata missing for table");
  }

  return {
    tableSessionId: sessionResult.data.id,
    tableId: tableResult.data.id,
    locationId: locationResult.data.id,
    tenantId: locationResult.data.tenant_id,
    currency: locationResult.data.currency ?? "",
  } satisfies SessionContext;
}

interface OrderInsertResult {
  orderId: string;
  paymentId: string;
}

export async function createOrderAndPayment(
  client: SupabaseClient,
  context: SessionContext,
  totals: CalculatedTotals,
  items: PaymentCartItem[],
  method: PaymentMethod
): Promise<OrderInsertResult> {
  const orderInsert = await client
    .from("orders")
    .insert({
      tenant_id: context.tenantId,
      location_id: context.locationId,
      table_id: context.tableId,
      table_session_id: context.tableSessionId,
      status: "submitted",
      subtotal_cents: totals.subtotalCents,
      tax_cents: totals.taxCents,
      service_cents: totals.serviceCents + totals.tipCents,
      total_cents: totals.totalCents,
      currency: context.currency || "RWF",
    })
    .select("id")
    .single();

  if (orderInsert.error || !orderInsert.data) {
    throw new Error(orderInsert.error?.message ?? "Failed to create order");
  }

  const orderId = orderInsert.data.id as string;

  if (items.length > 0) {
    const orderItemsPayload = items
      .filter((item) => item.quantity > 0)
      .map((item) => ({
        order_id: orderId,
        item_id: item.id,
        quantity: Math.floor(item.quantity),
        unit_price_cents: Math.max(0, Math.floor(item.unit_price_cents ?? 0)),
      }));
    if (orderItemsPayload.length > 0) {
      const orderItemsInsert = await client.from("order_items").insert(orderItemsPayload);
      if (orderItemsInsert.error) {
        throw new Error(`Failed to persist order items: ${orderItemsInsert.error.message}`);
      }
    }
  }

  const paymentInsert = await client
    .from("payments")
    .insert({
      order_id: orderId,
      method,
      status: "pending",
      amount_cents: totals.totalCents,
      currency: context.currency || "RWF",
      failure_reason: null,
    })
    .select("id")
    .single();

  if (paymentInsert.error || !paymentInsert.data) {
    throw new Error(paymentInsert.error?.message ?? "Failed to create payment record");
  }

  return {
    orderId,
    paymentId: paymentInsert.data.id as string,
  };
}

export async function markPaymentCaptured(
  client: SupabaseClient,
  identifier: {
    paymentId?: string;
    providerRef?: string;
    captureAmountCents?: number;
    newProviderRef?: string;
  }
): Promise<{ orderId: string; paymentId: string } | null> {
  let paymentLookup;
  if (identifier.paymentId) {
    paymentLookup = await client
      .from("payments")
      .select("id, order_id, amount_cents, status, provider_ref")
      .eq("id", identifier.paymentId)
      .maybeSingle();
  } else if (identifier.providerRef) {
    paymentLookup = await client
      .from("payments")
      .select("id, order_id, amount_cents, status, provider_ref")
      .eq("provider_ref", identifier.providerRef)
      .maybeSingle();
  } else {
    throw new Error("A payment identifier is required to mark capture");
  }

  if (paymentLookup?.error) {
    throw new Error(`Payment lookup failed: ${paymentLookup.error.message}`);
  }
  if (!paymentLookup?.data) {
    return null;
  }

  const nextProviderRef = identifier.newProviderRef ?? paymentLookup.data.provider_ref ?? null;
  const captureAmount = Math.max(
    0,
    Math.floor(identifier.captureAmountCents ?? paymentLookup.data.amount_cents ?? 0)
  );

  const paymentUpdate = await client
    .from("payments")
    .update({
      status: "captured",
      amount_cents: captureAmount,
      provider_ref: nextProviderRef,
      failure_reason: null,
    })
    .eq("id", paymentLookup.data.id)
    .select("id, order_id")
    .single();

  if (paymentUpdate.error || !paymentUpdate.data) {
    throw new Error(paymentUpdate.error?.message ?? "Failed to update payment status");
  }

  const orderUpdate = await client
    .from("orders")
    .update({ status: "settled" })
    .eq("id", paymentUpdate.data.order_id)
    .select("id")
    .single();

  if (orderUpdate.error) {
    throw new Error(`Failed to update order status: ${orderUpdate.error.message}`);
  }

  try {
    await client.rpc("enqueue_fiscalization_job", {
      order_uuid: paymentUpdate.data.order_id,
      payment_uuid: paymentUpdate.data.id,
    });
  } catch (queueError) {
    console.error("Failed to enqueue fiscalisation job", queueError);
  }

  await triggerReceiptsWorker(paymentUpdate.data.order_id as string, paymentUpdate.data.id as string);

  return { orderId: paymentUpdate.data.order_id as string, paymentId: paymentUpdate.data.id as string };
}

export async function markPaymentFailed(
  client: SupabaseClient,
  providerRef: string,
  reason?: string
): Promise<void> {
  const failureUpdate = await client
    .from("payments")
    .update({
      status: "failed",
      failure_reason:
        reason?.slice(0, 400) ??
        "The payment provider reported that this payment did not complete.",
    })
    .eq("provider_ref", providerRef);

  if (failureUpdate.error) {
    console.error("Failed to mark payment as failed", failureUpdate.error, {
      providerRef,
      reason,
    });
  }
}

export async function markPaymentRefunded(
  client: SupabaseClient,
  params: {
    paymentId?: string;
    providerRef?: string;
    refundAmountCents?: number;
    reason?: string;
  }
): Promise<{ orderId: string; paymentId: string } | null> {
  let paymentLookup;
  if (params.paymentId) {
    paymentLookup = await client
      .from("payments")
      .select("id, order_id, amount_cents, status")
      .eq("id", params.paymentId)
      .maybeSingle();
  } else if (params.providerRef) {
    paymentLookup = await client
      .from("payments")
      .select("id, order_id, amount_cents, status")
      .eq("provider_ref", params.providerRef)
      .maybeSingle();
  } else {
    throw new Error("A payment identifier is required to mark refund");
  }

  if (paymentLookup?.error) {
    throw new Error(`Payment lookup failed: ${paymentLookup.error.message}`);
  }
  if (!paymentLookup?.data) {
    return null;
  }

  const paymentId = paymentLookup.data.id as string;
  const orderId = paymentLookup.data.order_id as string;
  const refundAmount = Math.max(0, Math.floor(params.refundAmountCents ?? Number(paymentLookup.data.amount_cents ?? 0)));

  const paymentUpdate = await client
    .from("payments")
    .update({
      status: 'refunded',
      amount_cents: refundAmount,
      failure_reason: params.reason ?? 'Refund approved by staff',
    })
    .eq("id", paymentId)
    .select("id")
    .maybeSingle();

  if (paymentUpdate.error) {
    throw new Error(paymentUpdate.error.message);
  }

  const orderContext = await client
    .from('orders')
    .select('id, tenant_id, location_id, table_session_id')
    .eq('id', orderId)
    .maybeSingle();

  if (orderContext.error) {
    throw new Error(`Failed to load order context: ${orderContext.error.message}`);
  }

  const orderUpdate = await client
    .from("orders")
    .update({ status: 'voided' })
    .eq("id", orderId)
    .select("id")
    .maybeSingle();

  if (orderUpdate.error) {
    throw new Error(`Failed to update order status: ${orderUpdate.error.message}`);
  }

  await client.from('events').insert({
    tenant_id: orderContext.data?.tenant_id ?? null,
    location_id: orderContext.data?.location_id ?? null,
    table_session_id: orderContext.data?.table_session_id ?? null,
    type: 'payment.refund.processed',
    payload: {
      payment_id: paymentId,
      order_id: orderId,
      amount_cents: refundAmount,
      reason: params.reason ?? null,
    },
  });

  return { orderId, paymentId };
}
