import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleOnboardTenant } from "./onboard_tenant/index.ts";
import { handleReissueTableQr } from "./reissue_table_qr/index.ts";
import { handleAgentActions } from "./agent_actions/index.ts";

function extractSubPath(req: Request, prefix: string): string | null {
  const url = new URL(req.url);
  const basePath = url.pathname.replace(/^\/?functions\/v1\//, "");
  if (!basePath.startsWith(prefix)) {
    return null;
  }
  const remainder = basePath.slice(prefix.length);
  return remainder.replace(/^\//, "");
}

serve(async (req) => {
  const subPath = extractSubPath(req, "admin");
  switch (subPath) {
    case "onboard_tenant":
      return handleOnboardTenant(req);
    case "reissue_table_qr":
      return handleReissueTableQr(req);
    case "agent_actions":
      return handleAgentActions(req);
    default:
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
  }
});
