import {
  calculateTotals,
  createOrderAndPayment,
  createServiceRoleClient,
  errorResponse,
  jsonResponse,
  resolveSessionContext,
  startEdgeTrace,
  type PaymentCartItem,
} from "../../../_shared/payments.ts";

interface MobileMoneyRequest {
  currency?: string;
  items?: PaymentCartItem[];
  tax_cents?: number;
  tip_cents?: number;
  service_cents?: number;
  expected_subtotal_cents?: number;
  expected_total_cents?: number;
  payer_phone?: string;
  note?: string;
}

const MOMO_API_BASE = (Deno.env.get("MOMO_API_BASE") ?? "").replace(/\/$/, "");
const MOMO_SUBSCRIPTION_KEY = Deno.env.get("MOMO_SUBSCRIPTION_KEY") ?? "";
const MOMO_TARGET_ENV = Deno.env.get("MOMO_TARGET_ENV") ?? "sandbox";
const MOMO_CLIENT_ID = Deno.env.get("MOMO_CLIENT_ID") ?? "";
const MOMO_CLIENT_SECRET = Deno.env.get("MOMO_CLIENT_SECRET") ?? "";

async function obtainMtnAccessToken(): Promise<string> {
  if (!MOMO_API_BASE || !MOMO_SUBSCRIPTION_KEY || !MOMO_CLIENT_ID || !MOMO_CLIENT_SECRET) {
    throw new Error("MTN MoMo credentials are not configured");
  }

  const tokenUrl = `${MOMO_API_BASE}/collection/token/`;
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${MOMO_CLIENT_ID}:${MOMO_CLIENT_SECRET}`)}`,
      "Ocp-Apim-Subscription-Key": MOMO_SUBSCRIPTION_KEY,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MTN MoMo token request failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("MTN MoMo token payload missing access_token");
  }

  return json.access_token;
}

async function initiateRequestToPay(params: {
  token: string;
  referenceId: string;
  amount: number;
  currency: string;
  payerPhone: string;
  note?: string;
}) {
  const requestUrl = `${MOMO_API_BASE}/collection/v1_0/requesttopay`;
  const body = {
    amount: (params.amount / 100).toFixed(2),
    currency: params.currency,
    externalId: params.referenceId,
    payer: {
      partyIdType: "MSISDN",
      partyId: params.payerPhone,
    },
    payerMessage: params.note ?? "ICUPA diner payment",
    payeeNote: params.note ?? "ICUPA dine-in",
  };

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
      "X-Reference-Id": params.referenceId,
      "X-Target-Environment": MOMO_TARGET_ENV,
      "Ocp-Apim-Subscription-Key": MOMO_SUBSCRIPTION_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok && response.status !== 202) {
    const text = await response.text();
    throw new Error(`MTN MoMo request-to-pay failed (${response.status}): ${text}`);
  }
}

export async function handleMtnRequestToPay(req: Request): Promise<Response> {
  const span = startEdgeTrace('payments.mtn_momo.request_to_pay');
  let client;
  let sessionContext;

  try {
    if (req.method !== "POST") {
      return errorResponse(405, "method_not_allowed", "Only POST requests are supported");
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return errorResponse(415, "unsupported_media_type", "Expected JSON payload");
    }

    const payload = (await req.json()) as MobileMoneyRequest;
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (items.length === 0) {
      return errorResponse(400, "empty_cart", "At least one cart item is required");
    }

    const tableSessionId =
      req.headers.get("x-icupa-session") ?? req.headers.get("x-ICUPA-session") ?? "";
    if (!tableSessionId) {
      return errorResponse(401, "missing_session", "x-icupa-session header is required");
    }

    if (!payload.payer_phone) {
      return errorResponse(400, "missing_payer", "payer_phone must be provided for MTN MoMo payments");
    }

    const normalizedPhone = payload.payer_phone.replace(/[^0-9]/g, "");
    if (normalizedPhone.length < 9) {
      return errorResponse(400, "invalid_payer", "payer_phone must be a valid MSISDN");
    }

    client = createServiceRoleClient();
    sessionContext = await resolveSessionContext(client, tableSessionId);

    const requestedCurrency = (payload.currency ?? sessionContext.currency ?? "RWF").toUpperCase();
    if (requestedCurrency !== "RWF") {
      return errorResponse(400, "unsupported_currency", "MTN MoMo is available for RWF payments only");
    }

    const totals = calculateTotals(items, {
      tip_cents: payload.tip_cents,
      tax_cents: payload.tax_cents,
      service_cents: payload.service_cents,
      expected_subtotal_cents: payload.expected_subtotal_cents,
      expected_total_cents: payload.expected_total_cents,
    });

    const { orderId, paymentId } = await createOrderAndPayment(
      client,
      { ...sessionContext, currency: requestedCurrency },
      totals,
      items,
      "mtn_momo"
    );

    if (!MOMO_API_BASE || !MOMO_SUBSCRIPTION_KEY || !MOMO_CLIENT_ID || !MOMO_CLIENT_SECRET) {
      await span.end(client, {
        status: 'error',
        tenantId: sessionContext.tenantId,
        locationId: sessionContext.locationId,
        tableSessionId: sessionContext.tableSessionId,
        errorMessage: 'mtn_momo_credentials_missing',
      });
      return errorResponse(
        503,
        "momo_not_configured",
        "MTN MoMo credentials are not configured. Provide MOMO_API_BASE, MOMO_SUBSCRIPTION_KEY, MOMO_CLIENT_ID, and MOMO_CLIENT_SECRET before enabling mobile money payments.",
      );
    }

    const providerRef = crypto.randomUUID();
    const token = await obtainMtnAccessToken();
    await initiateRequestToPay({
      token,
      referenceId: providerRef,
      amount: totals.totalCents,
      currency: requestedCurrency,
      payerPhone: normalizedPhone,
      note: payload.note,
    });

    const updateResult = await client
      .from("payments")
      .update({ provider_ref: providerRef })
      .eq("id", paymentId);

    if (updateResult.error) {
      console.error("Failed to update MoMo provider reference", updateResult.error, { paymentId });
    }

    const eventInsert = await client.from("events").insert({
      tenant_id: sessionContext.tenantId,
      location_id: sessionContext.locationId,
      table_session_id: sessionContext.tableSessionId,
      type: "payment.mtn_momo.requested",
      payload: {
        order_id: orderId,
        payment_id: paymentId,
        payer_phone: normalizedPhone,
        reference_id: providerRef,
      },
    });

    if (eventInsert.error) {
      console.error("Failed to log MTN MoMo request event", eventInsert.error, {
        orderId,
        paymentId,
      });
    }

    const response = jsonResponse({
      order_id: orderId,
      payment_id: paymentId,
      payment_status: "pending",
      payment_method: "mtn_momo",
      provider_ref: providerRef,
      total_cents: totals.totalCents,
      message: "MTN MoMo payment initiated. Awaiting provider confirmation.",
    });
    await span.end(client, {
      status: 'success',
      tenantId: sessionContext.tenantId,
      locationId: sessionContext.locationId,
      tableSessionId: sessionContext.tableSessionId,
      attributes: {
        payment_id: paymentId,
        total_cents: totals.totalCents,
      },
    });
    return response;
  } catch (error) {
    console.error("MoMo request-to-pay error", error);
    if (client && sessionContext) {
      await span.end(client, {
        status: 'error',
        tenantId: sessionContext.tenantId,
        locationId: sessionContext.locationId,
        tableSessionId: sessionContext.tableSessionId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
    return errorResponse(500, "momo_request_failed", "Failed to initiate MTN MoMo payment");
  }
}

export default handleMtnRequestToPay;
