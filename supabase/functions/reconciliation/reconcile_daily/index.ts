import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  createServiceRoleClient,
  errorResponse,
  jsonResponse,
} from "../../_shared/payments.ts";

interface ReconcileRequestBody {
  since_hours?: number; // default 24
  tenant_id?: string; // optional filter
  location_id?: string; // optional filter
}

serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST is supported");
  }

  // This endpoint should be invoked by trusted automation only (service role key in Authorization header)
  // Supabase Edge Functions will pass through the bearer token to Postgrest, so RLS is bypassed via service role.
  const client = createServiceRoleClient();

  let payload: ReconcileRequestBody;
  try {
    payload = (await req.json()) as ReconcileRequestBody;
  } catch (_error) {
    payload = {} as ReconcileRequestBody;
  }

  const sinceHours = Number.isFinite(payload.since_hours) && (payload.since_hours as number) > 0
    ? Math.min(Number(payload.since_hours), 168)
    : 24;

  try {
    // Find captured payments in the window
    let paymentsQuery = client
      .from("payments")
      .select("id, order_id, method, provider_ref, created_at, orders(tenant_id, location_id)")
      .eq("status", "captured")
      .gte("created_at", new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString());

    if (payload.tenant_id) {
      paymentsQuery = paymentsQuery.eq("orders.tenant_id", payload.tenant_id);
    }
    if (payload.location_id) {
      paymentsQuery = paymentsQuery.eq("orders.location_id", payload.location_id);
    }

    const { data: payments, error: paymentsError } = await paymentsQuery;
    if (paymentsError) {
      throw new Error(paymentsError.message);
    }

    const paymentsList = (payments ?? []) as Array<{
      id: string; order_id: string; method: string | null; provider_ref: string | null;
      created_at: string; orders: { tenant_id: string | null; location_id: string | null } | null
    }>;

    let inspected = 0;
    let withReceipts = 0;
    let enqueued = 0;

    for (const p of paymentsList) {
      inspected += 1;
      const { data: receipt, error: receiptError } = await client
        .from("receipts")
        .select("id")
        .eq("order_id", p.order_id)
        .maybeSingle();
      if (receiptError) {
        throw new Error(`Receipt lookup failed: ${receiptError.message}`);
      }
      if (receipt) {
        withReceipts += 1;
        continue;
      }
      try {
        await client.rpc("enqueue_fiscalization_job", {
          order_uuid: p.order_id,
          payment_uuid: p.id,
        });
        enqueued += 1;
      } catch (e) {
        console.error("Failed to enqueue fiscalization job during reconciliation", e, { orderId: p.order_id, paymentId: p.id });
      }
    }

    return jsonResponse({ ok: true, inspected, with_receipts: withReceipts, enqueued });
  } catch (error) {
    console.error("Reconciliation failure", error);
    return errorResponse(500, "reconciliation_failed", "Unable to run reconciliation right now");
  }
});

