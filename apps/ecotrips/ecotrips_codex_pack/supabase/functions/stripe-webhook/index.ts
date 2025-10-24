import { serve } from "serve";

serve(async (_req) => {
  return new Response(JSON.stringify({ ok: true }),
    { headers: { "content-type": "application/json" } });
});