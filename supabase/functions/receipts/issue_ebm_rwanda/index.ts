import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, jsonResponse } from "../../_shared/payments.ts";
import {
  ReceiptContextInput,
  simulateRwandaReceipt,
} from "../../_shared/receipts.ts";

interface IssueReceiptRequest {
  order_id: string;
  payment_id: string;
  tenant_id: string;
  location_id: string;
  currency: string;
  subtotal_cents: number;
  tax_cents: number;
  service_cents: number;
  total_cents: number;
  provider_ref?: string | null;
  line_items?: Array<{
    name: string;
    quantity: number;
    unit_price_cents: number;
  }>;
}

const validatePayload = (payload: IssueReceiptRequest): payload is IssueReceiptRequest => {
  if (!payload) return false;
  const required = [
    payload.order_id,
    payload.payment_id,
    payload.tenant_id,
    payload.location_id,
    payload.currency,
  ];
  return required.every((value) => typeof value === "string" && value.length > 0);
};

serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST is supported");
  }

  let body: IssueReceiptRequest;
  try {
    body = await req.json();
  } catch (_error) {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON");
  }

  if (!validatePayload(body)) {
    return errorResponse(400, "missing_fields", "order_id, payment_id, tenant_id, location_id, and currency are required");
  }

  const context: ReceiptContextInput = {
    orderId: body.order_id,
    paymentId: body.payment_id,
    tenantId: body.tenant_id,
    locationId: body.location_id,
    currency: body.currency,
    subtotalCents: Math.max(0, Math.floor(body.subtotal_cents ?? 0)),
    taxCents: Math.max(0, Math.floor(body.tax_cents ?? 0)),
    serviceCents: Math.max(0, Math.floor(body.service_cents ?? 0)),
    totalCents: Math.max(0, Math.floor(body.total_cents ?? 0)),
    providerRef: body.provider_ref ?? null,
    region: "RW",
    lineItems: (body.line_items ?? []).map((item) => ({
      name: item.name ?? "Menu item",
      quantity: Math.max(1, Math.floor(item.quantity ?? 1)),
      unitPriceCents: Math.max(0, Math.floor(item.unit_price_cents ?? 0)),
    })),
  };

  const simulated = simulateRwandaReceipt(context);

  return jsonResponse({
    status: "simulated",
    receipt: simulated.summary,
    payload: simulated.payload,
    integration_notes: simulated.integrationNotes,
  });
});
