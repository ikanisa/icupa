import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { resolveSupplierAuth } from "../_shared/suppliers.ts";

import fixtureOrders from "../../../ops/fixtures/supplier_orders.json" assert { type: "json" };

interface FixtureOrder {
  id: string;
  supplier_slug: string;
  status: string;
}

const orders = Array.isArray(fixtureOrders) ? fixtureOrders as FixtureOrder[] : [];

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("supplier-confirm");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const orderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
  const status = typeof body.status === "string" && body.status.trim()
    ? body.status.trim()
    : "confirmed";
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

  if (!orderId) {
    const error = new Error("order_id is required");
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const auth = await resolveSupplierAuth(req);
  if (!auth.valid || !auth.supplierSlug) {
    return jsonResponse({ ok: false, error: "unauthorized", request_id: requestId }, 401);
  }

  const matched = orders.find((order) => order.id === orderId && order.supplier_slug === auth.supplierSlug);
  const previousStatus = matched?.status ?? "unknown";

  console.log(JSON.stringify({
    level: "AUDIT",
    event: "supplier.confirmation",
    fn: "supplier-confirm",
    requestId,
    orderId,
    supplier: auth.supplierSlug,
    actor: auth.actor,
    previousStatus,
    status,
    note,
  }));

  return jsonResponse({
    ok: true,
    order_id: orderId,
    status,
    request_id: requestId,
    message: matched ? "Confirmation recorded from fixtures." : "Order recorded for reconciliation.",
  });
}, { fn: "supplier-confirm", defaultErrorCode: ERROR_CODES.INPUT_INVALID });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default handler;
