import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleDsr } from "./dsr/index.ts";

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
  const subPath = extractSubPath(req, "compliance");
  switch (subPath) {
    case "dsr":
      return handleDsr(req);
    default:
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
  }
});
