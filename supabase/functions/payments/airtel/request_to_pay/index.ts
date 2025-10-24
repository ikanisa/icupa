import { readHeader } from '../../../_shared/headers.ts';
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

interface AirtelMoneyRequest {
  currency?: string;
  items?: PaymentCartItem[];
  tax_cents?: number;
  tip_cents?: number;
  service_cents?: number;
  expected_subtotal_cents?: number;
  expected_total_cents?: number;
  msisdn?: string;
}

const AIRTEL_API_BASE = (Deno.env.get("AIRTEL_API_BASE") ?? "").replace(/\/$/, "");
const AIRTEL_CLIENT_ID = Deno.env.get("AIRTEL_CLIENT_ID") ?? "";
const AIRTEL_CLIENT_SECRET = Deno.env.get("AIRTEL_CLIENT_SECRET") ?? "";
const AIRTEL_COUNTRY = Deno.env.get("AIRTEL_COUNTRY") ?? "RW";
const AIRTEL_CURRENCY = Deno.env.get("AIRTEL_CURRENCY") ?? "RWF";

async function obtainAirtelToken(): Promise<string> {
  if (!AIRTEL_API_BASE || !AIRTEL_CLIENT_ID || !AIRTEL_CLIENT_SECRET) {
    throw new Error("Airtel Money credentials are not configured");
  }

  const response = await fetch(`${AIRTEL_API_BASE}/auth/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: AIRTEL_CLIENT_ID,
      client_secret: AIRTEL_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Airtel token request failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("Airtel token payload missing access_token");
  }

  return json.access_token;
}

async function initiateAirtelCollection(params: {
  token: string;
  referenceId: string;
  amount: number;
  currency: string;
  msisdn: string;
}) {
  const endpoint = `${AIRTEL_API_BASE}/standard/v1/payments`; // standard collection API
  const body = {
    reference: params.referenceId,
    subscriber: {
      country: AIRTEL_COUNTRY,
      currency: params.currency,
      msisdn: params.msisdn,
    },
    transaction: {
      amount: (params.amount / 100).toFixed(2),
      country: AIRTEL_COUNTRY,
      currency: params.currency,
      id: params.referenceId,
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Airtel request-to-pay failed (${response.status}): ${text}`);
  }
}

export async function handleAirtelRequestToPay(req: Request): Promise<Response> {
  const span = startEdgeTrace('payments.airtel.request_to_pay');
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

    const payload = (await req.json()) as AirtelMoneyRequest;
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (items.length === 0) {
      return errorResponse(400, "empty_cart", "At least one cart item is required");
    }

    const tableSessionId = readHeader(req, 'x-icupa-session') ?? '';
    if (!tableSessionId) {
      return errorResponse(401, "missing_session", "x-icupa-session header is required");
    }

    if (!payload.msisdn) {
      return errorResponse(400, "missing_payer", "msisdn must be provided for Airtel Money payments");
    }

    const normalizedMsisdn = payload.msisdn.replace(/[^0-9]/g, "");
    if (normalizedMsisdn.length < 9) {
      return errorResponse(400, "invalid_payer", "msisdn must be a valid subscriber number");
    }

    client = createServiceRoleClient();
    sessionContext = await resolveSessionContext(client, tableSessionId);

    const requestedCurrency = (payload.currency ?? sessionContext.currency ?? AIRTEL_CURRENCY).toUpperCase();
    if (requestedCurrency !== "RWF") {
      return errorResponse(400, "unsupported_currency", "Airtel Money is available for RWF payments only");
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
      "airtel_money"
    );

    if (!AIRTEL_API_BASE || !AIRTEL_CLIENT_ID || !AIRTEL_CLIENT_SECRET) {
      await span.end(client, {
        status: 'error',
        tenantId: sessionContext.tenantId,
        locationId: sessionContext.locationId,
        tableSessionId: sessionContext.tableSessionId,
        errorMessage: 'airtel_credentials_missing',
      });
      return errorResponse(
        503,
        "airtel_not_configured",
        "Airtel Money credentials are not configured. Provide AIRTEL_API_BASE, AIRTEL_CLIENT_ID, and AIRTEL_CLIENT_SECRET before enabling Airtel collections.",
      );
    }

    const providerRef = crypto.randomUUID();
    const token = await obtainAirtelToken();
    await initiateAirtelCollection({
      token,
      referenceId: providerRef,
      amount: totals.totalCents,
      currency: requestedCurrency,
      msisdn: normalizedMsisdn,
    });

    const updateResult = await client
      .from("payments")
      .update({ provider_ref: providerRef })
      .eq("id", paymentId);

    if (updateResult.error) {
      console.error("Failed to update Airtel Money provider reference", updateResult.error, { paymentId });
    }

    const eventInsert = await client.from("events").insert({
      tenant_id: sessionContext.tenantId,
      location_id: sessionContext.locationId,
      table_session_id: sessionContext.tableSessionId,
      type: "payment.airtel.requested",
      payload: {
        order_id: orderId,
        payment_id: paymentId,
        msisdn: normalizedMsisdn,
        reference_id: providerRef,
      },
    });

    if (eventInsert.error) {
      console.error("Failed to log Airtel Money request event", eventInsert.error, {
        orderId,
        paymentId,
      });
    }

    const response = jsonResponse({
      order_id: orderId,
      payment_id: paymentId,
      payment_status: "pending",
      payment_method: "airtel_money",
      provider_ref: providerRef,
      total_cents: totals.totalCents,
      message: "Airtel Money payment initiated. Awaiting provider confirmation.",
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
    console.error("Airtel request-to-pay error", error);
    if (client && sessionContext) {
      await span.end(client, {
        status: 'error',
        tenantId: sessionContext.tenantId,
        locationId: sessionContext.locationId,
        tableSessionId: sessionContext.tableSessionId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
    return errorResponse(500, "airtel_request_failed", "Failed to initiate Airtel Money payment");
  }
}

export default handleAirtelRequestToPay;
