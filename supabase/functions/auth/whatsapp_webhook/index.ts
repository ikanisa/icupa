import { createMetaWebhookHandler } from "../../_shared/metaWebhookGuard.ts";

// No production durable inbox has been established in this investigation.
// Valid POSTs therefore stay at 503. Do not replace this with a log-and-200 stub.
// The GET subscription check is separate and cannot authenticate POST payloads.
const guarded = createMetaWebhookHandler((key) => Deno.env.get(key));

export async function handleWhatsAppWebhook(req: Request): Promise<Response> {
  return guarded(req);
}

export default handleWhatsAppWebhook;
