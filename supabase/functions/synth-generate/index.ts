import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { resolveGroupAuth } from "../_shared/groups.ts";

import bookingFixtures from "../../../ops/fixtures/bookings.json" assert { type: "json" };
import exceptionFixtures from "../../../ops/fixtures/exceptions.json" assert { type: "json" };
import supplierOrders from "../../../ops/fixtures/supplier_orders.json" assert { type: "json" };

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("synth-generate");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const auth = await resolveGroupAuth(req, { includePersona: true });
  if (!auth.isOps) {
    return jsonResponse({ ok: false, error: "unauthorized", request_id: requestId }, 401);
  }

  const seeded = [
    {
      key: "bookings",
      count: Array.isArray(bookingFixtures) ? bookingFixtures.length : 0,
    },
    {
      key: "exceptions",
      count: Array.isArray(exceptionFixtures) ? exceptionFixtures.length : 0,
    },
    {
      key: "supplier_orders",
      count: Array.isArray(supplierOrders) ? supplierOrders.length : 0,
    },
  ];

  console.log(JSON.stringify({
    level: "AUDIT",
    event: "synth.generate.seeded",
    fn: "synth-generate",
    requestId,
    actor: auth.actorLabel,
    seeded,
  }));

  return jsonResponse({
    ok: true,
    request_id: requestId,
    seeded,
    message: "Synthetic fixtures staged for preview environments.",
  });
}, { fn: "synth-generate", defaultErrorCode: ERROR_CODES.INPUT_INVALID });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default handler;
