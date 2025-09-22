import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { ERROR_CODES } from "../_obs/constants.ts";
import { healthResponse, withObs } from "../_obs/withObs.ts";

const handler = withObs(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("supplier-webhook");
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  }

  try {
    await req.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    (wrapped as { code?: string }).code ??= ERROR_CODES.TRANSIENT_RETRY;
    throw wrapped;
  }
}, { fn: "supplier-webhook", defaultErrorCode: ERROR_CODES.TRANSIENT_RETRY });

serve(handler);
