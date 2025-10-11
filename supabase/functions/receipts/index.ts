import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleIssueEbmRwanda } from "./issue_ebm_rwanda/index.ts";
import { handleIssueFiscalMalta } from "./issue_fiscal_malta/index.ts";
import { handleProcessQueue } from "./process_queue/index.ts";

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
  const subPath = extractSubPath(req, "receipts");
  switch (subPath) {
    case "issue_ebm_rwanda":
      return handleIssueEbmRwanda(req);
    case "issue_fiscal_malta":
      return handleIssueFiscalMalta(req);
    case "process_queue":
      return handleProcessQueue(req);
    default:
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
  }
});
