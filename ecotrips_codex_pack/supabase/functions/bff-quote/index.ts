import { serve } from "serve";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
    }
    const body = await req.json().catch(() => ({}));
    const quote = { total_cents: 123450, currency: "USD", items: [] };
    return new Response(JSON.stringify({ ok: true, quote }), {
      headers: { "content-type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});