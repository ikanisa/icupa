import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleDbHealth } from "./db_health/index.ts";
import { handleUpdateScheduler } from "./update_scheduler/index.ts";
import { handleEnqueueTestReceipt } from "./enqueue_test_receipt/index.ts";

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
  const subPath = extractSubPath(req, "ops");
  switch (subPath) {
    case "db_health":
      return handleDbHealth(req);
    case "update_scheduler":
      return handleUpdateScheduler(req);
    case "enqueue_test_receipt":
      return handleEnqueueTestReceipt(req);
    default:
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
  }
});
