import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  createServiceRoleClient,
  errorResponse,
  jsonResponse,
} from "../../_shared/payments.ts";
import {
  ReceiptContextInput,
  simulateMaltaReceipt,
  simulateRwandaReceipt,
  RegionCode,
} from "../../_shared/receipts.ts";

interface FiscalizationJobRow {
  msg_id: number;
  order_id: string;
  payment_id: string;
  enqueued_at?: string | null;
}

interface OrderRow {
  id: string;
  tenant_id: string;
  location_id: string;
  table_session_id: string | null;
  subtotal_cents: number | null;
  tax_cents: number | null;
  service_cents: number | null;
  total_cents: number | null;
  currency: string | null;
}

interface LocationRow {
  id: string;
  tenant_id: string;
  region: RegionCode | null;
  vat_rate?: number | null;
}

interface PaymentRow {
  id: string;
  method: string | null;
  provider_ref: string | null;
}

interface OrderItemRow {
  quantity: number | null;
  unit_price_cents: number | null;
  items?: {
    name?: string | null;
  } | null;
}

const VISIBILITY_TIMEOUT_SECONDS = 90;

type JobLogFunction =
  | "log_fiscalization_job_processing"
  | "log_fiscalization_job_completed"
  | "log_fiscalization_job_failed"
  | "log_fiscalization_job_skipped";

const normaliseRegion = (value: string | null | undefined): RegionCode => {
  return value?.toUpperCase() === "RW" ? "RW" : "EU";
};

const mapLineItems = (rows: OrderItemRow[]) =>
  rows.map((row) => ({
    name: row.items?.name ?? "Menu item",
    quantity: Math.max(1, Math.floor(row.quantity ?? 1)),
    unitPriceCents: Math.max(0, Math.floor(row.unit_price_cents ?? 0)),
  }));

const fetchJob = async () => {
  const client = createServiceRoleClient();
  const { data, error } = await client.rpc<FiscalizationJobRow[]>("dequeue_fiscalization_job", {
    visibility_timeout_seconds: VISIBILITY_TIMEOUT_SECONDS,
  });

  if (error) {
    throw new Error(`Failed to dequeue fiscalisation job: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return { client, job: null } as const;
  }

  return { client, job: data[0]! } as const;
};

const safeLogJob = async (
  client: ReturnType<typeof createServiceRoleClient>,
  fn: JobLogFunction,
  payload: Record<string, unknown>,
  job: FiscalizationJobRow
) => {
  try {
    const { error } = await client.rpc(fn, payload);
    if (error) {
      throw error;
    }
  } catch (logError) {
    console.error(`Failed to ${fn.replace(/_/g, " ")}`, logError, {
      jobId: job.msg_id,
      orderId: job.order_id,
      paymentId: job.payment_id,
    });
  }
};

const logJobProcessing = async (
  client: ReturnType<typeof createServiceRoleClient>,
  job: FiscalizationJobRow
) =>
  safeLogJob(
    client,
    "log_fiscalization_job_processing",
    { order_uuid: job.order_id, payment_uuid: job.payment_id },
    job
  );

const logJobCompleted = async (
  client: ReturnType<typeof createServiceRoleClient>,
  job: FiscalizationJobRow,
  receiptId: string
) =>
  safeLogJob(
    client,
    "log_fiscalization_job_completed",
    { order_uuid: job.order_id, payment_uuid: job.payment_id, receipt_uuid: receiptId },
    job
  );

const logJobFailure = async (
  client: ReturnType<typeof createServiceRoleClient>,
  job: FiscalizationJobRow,
  reason: unknown
) =>
  safeLogJob(
    client,
    "log_fiscalization_job_failed",
    {
      order_uuid: job.order_id,
      payment_uuid: job.payment_id,
      failure_reason: typeof reason === "string" ? reason : String(reason ?? "Receipt generation failed"),
    },
    job
  );

const logJobSkipped = async (
  client: ReturnType<typeof createServiceRoleClient>,
  job: FiscalizationJobRow,
  reason: string
) =>
  safeLogJob(
    client,
    "log_fiscalization_job_skipped",
    { order_uuid: job.order_id, payment_uuid: job.payment_id, skip_reason: reason },
    job
  );

serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST is supported");
  }

  let client;
  let job: FiscalizationJobRow | null = null;

  try {
    const dequeueResult = await fetchJob();
    client = dequeueResult.client;
    job = dequeueResult.job;
  } catch (error) {
    console.error("Fiscalisation queue dequeue failed", error);
    return errorResponse(500, "queue_unavailable", "Unable to read fiscalisation queue");
  }

  if (!job) {
    return jsonResponse({ status: "empty" }, 204);
  }

  await logJobProcessing(client, job);

  const deleteJob = async () => {
    try {
      await client.rpc("delete_fiscalization_job", { msg_id: job!.msg_id });
    } catch (deleteError) {
      console.error("Failed to delete fiscalisation job", deleteError, { jobId: job?.msg_id });
    }
  };

  try {
    const { data: order, error: orderError } = await client
      .from("orders")
      .select(
        "id, tenant_id, location_id, table_session_id, subtotal_cents, tax_cents, service_cents, total_cents, currency"
      )
      .eq("id", job.order_id)
      .maybeSingle<OrderRow>();

    if (orderError) {
      throw new Error(`Failed to load order: ${orderError.message}`);
    }

    if (!order) {
      console.warn("Fiscalisation job discarded due to missing order", job);
      await logJobSkipped(client, job, "Order no longer exists");
      await deleteJob();
      return errorResponse(410, "order_not_found", "Order no longer exists");
    }

    const { data: location, error: locationError } = await client
      .from("locations")
      .select("id, tenant_id, region, vat_rate")
      .eq("id", order.location_id)
      .maybeSingle<LocationRow>();

    if (locationError) {
      throw new Error(`Failed to load location: ${locationError.message}`);
    }

    if (!location) {
      throw new Error("Location not found for order");
    }

    const { data: payment, error: paymentError } = await client
      .from("payments")
      .select("id, method, provider_ref")
      .eq("id", job.payment_id)
      .maybeSingle<PaymentRow>();

    if (paymentError) {
      throw new Error(`Failed to load payment: ${paymentError.message}`);
    }

    if (!payment) {
      await logJobSkipped(client, job, "Payment record missing for fiscalisation job");
      await deleteJob();
      return errorResponse(410, "payment_not_found", "Payment record is no longer available");
    }

    const { data: orderItems, error: itemError } = await client
      .from("order_items")
      .select("quantity, unit_price_cents, items(name)")
      .eq("order_id", job.order_id)
      .returns<OrderItemRow[]>();

    if (itemError) {
      throw new Error(`Failed to load order items: ${itemError.message}`);
    }

    const region = normaliseRegion(location.region ?? null);

    const context: ReceiptContextInput = {
      orderId: order.id,
      paymentId: payment.id,
      tenantId: location.tenant_id ?? order.tenant_id,
      locationId: order.location_id,
      currency: order.currency ?? "RWF",
      subtotalCents: Math.max(0, Math.floor(order.subtotal_cents ?? 0)),
      taxCents: Math.max(0, Math.floor(order.tax_cents ?? 0)),
      serviceCents: Math.max(0, Math.floor(order.service_cents ?? 0)),
      totalCents: Math.max(0, Math.floor(order.total_cents ?? 0)),
      providerRef: payment.provider_ref,
      region,
      lineItems: mapLineItems(orderItems ?? []),
    };

    const simulated = region === "RW" ? simulateRwandaReceipt(context) : simulateMaltaReceipt(context);

    const { data: receiptInsert, error: receiptError } = await client
      .from("receipts")
      .insert({
        order_id: order.id,
        region,
        fiscal_id: simulated.summary.fiscalId,
        url: simulated.summary.url,
        payload: {
          summary: simulated.summary,
          integration_notes: simulated.integrationNotes,
          raw: simulated.payload,
        },
      })
      .select("id, created_at")
      .single();

    if (receiptError) {
      throw new Error(`Failed to persist receipt: ${receiptError.message}`);
    }

    try {
      await client.from("events").insert({
        tenant_id: order.tenant_id,
        location_id: order.location_id,
        table_session_id: order.table_session_id,
        type: "receipt_issued",
        payload: {
          receipt_id: receiptInsert.id,
          order_id: order.id,
          payment_id: payment.id,
          fiscal_id: simulated.summary.fiscalId,
          region,
          url: simulated.summary.url,
        },
      });
    } catch (eventError) {
      console.error("Failed to append receipt event", eventError, { orderId: order.id });
    }

    await deleteJob();

    await logJobCompleted(client, job, receiptInsert.id as string);

    return jsonResponse({
      status: "processed",
      receipt_id: receiptInsert.id,
      fiscal_id: simulated.summary.fiscalId,
      region,
    });
  } catch (error) {
    console.error("Fiscalisation job processing failed", error, { job });
    await logJobFailure(client, job, error instanceof Error ? error.message : error);
    return errorResponse(500, "receipt_generation_failed", "Unable to generate receipt right now");
  }
});
