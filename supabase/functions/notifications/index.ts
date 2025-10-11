import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleSubscribePush } from "./subscribe_push/index.ts";
import { handleSendPush } from "./send_push/index.ts";
import { handleUnsubscribePush } from "./unsubscribe_push/index.ts";

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
  const subPath = extractSubPath(req, "notifications");
  switch (subPath) {
    case "subscribe_push":
      return handleSubscribePush(req);
    case "unsubscribe_push":
      return handleUnsubscribePush(req);
    case "send_push":
      return handleSendPush(req);
    default:
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
  }
});
