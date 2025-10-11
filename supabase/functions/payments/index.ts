import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleStripeCheckout } from "./stripe/checkout/index.ts";
import { handleStripeWebhook } from "./stripe/webhook/index.ts";
import { handleMtnRequestToPay } from "./momo/request_to_pay/index.ts";
import { handleMtnWebhook } from "./momo/webhook/index.ts";
import { handleAirtelRequestToPay } from "./airtel/request_to_pay/index.ts";
import { handleAirtelWebhook } from "./airtel/webhook/index.ts";
import { handleRefund } from "./refund/index.ts";

function extractSubPath(req: Request, prefix: string): string | null {
  const url = new URL(req.url);
  let basePath = url.pathname.replace(/^\/?functions\/v1\//, "");
  basePath = basePath.replace(/^\/+/, "");
  if (!basePath.startsWith(prefix)) {
    return null;
  }
  const remainder = basePath.slice(prefix.length);
  return remainder.replace(/^\/+/, "");
}

serve(async (req) => {
  const subPath = extractSubPath(req, "payments");
  switch (subPath) {
    case "stripe/checkout":
      return handleStripeCheckout(req);
    case "stripe/webhook":
      return handleStripeWebhook(req);
    case "mtn_momo/request_to_pay":
    case "momo/request_to_pay":
      return handleMtnRequestToPay(req);
    case "mtn_momo/webhook":
    case "momo/webhook":
      return handleMtnWebhook(req);
    case "airtel/request_to_pay":
      return handleAirtelRequestToPay(req);
    case "airtel/webhook":
      return handleAirtelWebhook(req);
    case "refund":
      return handleRefund(req);
    default:
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
  }
});
