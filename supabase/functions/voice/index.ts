import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import handleVoiceSession from "./session/index.ts";

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
  const subPath = extractSubPath(req, "voice");
  switch (subPath) {
    case "session":
      return handleVoiceSession(req);
    default:
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
  }
});
