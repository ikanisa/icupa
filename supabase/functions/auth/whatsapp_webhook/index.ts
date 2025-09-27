const VERIFY_TOKEN = Deno.env.get("WA_VERIFY_TOKEN") ?? "";

export async function handleWhatsAppWebhook(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token && challenge && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Invalid verification", { status: 403 });
  }

  if (req.method === "POST") {
    try {
      const payload = await req.json();
      const entry = Array.isArray(payload?.entry) ? payload.entry[0] : null;
      const changes = Array.isArray(entry?.changes) ? entry.changes[0] : null;
      const value = changes?.value ?? {};

      const message = Array.isArray(value.messages) ? value.messages[0] : null;
      if (message) {
        console.log("Received WhatsApp webhook event", {
          channel: message.channel ?? "whatsapp",
          messageId: message.id ?? "unknown",
          type: message.type ?? "unknown",
        });
      }
    } catch (error) {
      console.error("Failed to process WhatsApp webhook payload", error);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
}

export default handleWhatsAppWebhook;
