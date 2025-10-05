import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  errorResponse,
  jsonResponse,
  markPaymentCaptured,
} from "../../_shared/payments.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Manual capture function missing Supabase credentials");
}

type AllowedRole = "owner" | "manager" | "cashier" | "admin";

interface ManualCaptureRequest {
  payment_id?: string;
  capture_amount_cents?: number;
  provider_ref?: string;
  notes?: string;
}

async function createClientForRequest(req: Request): Promise<SupabaseClient> {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });
}

function sanitiseNotes(notes?: string | null): string | null {
  if (typeof notes !== "string") {
    return null;
  }
  const trimmed = notes.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 500);
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return errorResponse(405, "method_not_allowed", "Only POST requests are supported");
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return errorResponse(415, "unsupported_media_type", "Expected JSON payload");
    }

    const payload = (await req.json()) as ManualCaptureRequest;
    const paymentId = typeof payload.payment_id === "string" ? payload.payment_id : "";
    if (!paymentId) {
      return errorResponse(400, "missing_payment_id", "payment_id is required");
    }

    const client = await createClientForRequest(req);
    const { data: userResult, error: userError } = await client.auth.getUser();
    if (userError || !userResult?.user) {
      return errorResponse(401, "unauthenticated", "A valid staff session is required");
    }

    const actorId = userResult.user.id;

    const { data: paymentRow, error: paymentError } = await client
      .from("payments")
      .select("id, order_id, status, amount_cents, provider_ref")
      .eq("id", paymentId)
      .maybeSingle();

    if (paymentError) {
      return errorResponse(400, "payment_lookup_failed", paymentError.message);
    }
    if (!paymentRow) {
      return errorResponse(404, "payment_not_found", "Payment could not be located");
    }

    const { data: orderRow, error: orderError } = await client
      .from("orders")
      .select("id, tenant_id, location_id, status, table_id")
      .eq("id", paymentRow.order_id)
      .maybeSingle();

    if (orderError) {
      return errorResponse(400, "order_lookup_failed", orderError.message);
    }
    if (!orderRow) {
      return errorResponse(404, "order_not_found", "Associated order was not found");
    }

    const allowedRoles: AllowedRole[] = ["owner", "manager", "cashier", "admin"];
    const { data: roleRows, error: roleError } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", actorId)
      .eq("tenant_id", orderRow.tenant_id);

    if (roleError) {
      return errorResponse(500, "role_lookup_failed", roleError.message);
    }

    const hasRole = (roleRows ?? []).some((row) => allowedRoles.includes(row.role as AllowedRole));
    if (!hasRole) {
      return errorResponse(403, "forbidden", "Only tenant staff can capture payments");
    }

    const captureAmount = Number.isFinite(payload.capture_amount_cents)
      ? Math.max(0, Math.floor(payload.capture_amount_cents ?? 0))
      : undefined;
    const providerRef = typeof payload.provider_ref === "string" && payload.provider_ref.trim().length > 0
      ? payload.provider_ref.trim()
      : undefined;

    const captureResult = await markPaymentCaptured(client, {
      paymentId,
      captureAmountCents: captureAmount,
      newProviderRef: providerRef,
    });

    if (!captureResult) {
      return errorResponse(404, "payment_not_found", "Payment could not be located");
    }

    const notes = sanitiseNotes(payload.notes);
    const paymentUpdate: Record<string, unknown> = {
      captured_by: actorId,
    };
    if (notes !== null) {
      paymentUpdate.captured_notes = notes;
    }

    const updateResult = await client
      .from("payments")
      .update(paymentUpdate)
      .eq("id", captureResult.paymentId)
      .select("captured_at, captured_by, captured_notes")
      .maybeSingle();

    if (updateResult.error) {
      return errorResponse(500, "capture_update_failed", updateResult.error.message);
    }

    await client.from("payment_action_events").insert({
      payment_id: captureResult.paymentId,
      order_id: captureResult.orderId,
      action: "manual_capture",
      notes,
      metadata: {
        capture_amount_cents: captureAmount ?? paymentRow.amount_cents ?? null,
        provider_ref: providerRef ?? paymentRow.provider_ref ?? null,
        table_id: orderRow.table_id ?? null,
      },
      actor_id: actorId,
    });

    return jsonResponse({
      data: {
        payment_id: captureResult.paymentId,
        order_id: captureResult.orderId,
        captured_at: updateResult.data?.captured_at ?? null,
        captured_by: updateResult.data?.captured_by ?? actorId,
        captured_notes: updateResult.data?.captured_notes ?? notes,
      },
    });
  } catch (error) {
    console.error("Manual capture failed", error);
    return errorResponse(500, "capture_failed", "Manual capture failed unexpectedly");
  }
});
