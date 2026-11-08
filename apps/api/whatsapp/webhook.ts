/** Recovery-period adapter: no AI invocation or direct outbound send on receipt. */
import { createMetaWebhookHandler, verifySubscription } from "../../../supabase/functions/_shared/metaWebhookGuard";
import { sendTextMessage } from "./send";

const readEnv = (key: string) => process.env[key];
const guarded = createMetaWebhookHandler(readEnv);

export function verifyWebhook(query: Record<string, unknown>): { challenge?: string; error?: string } {
  return verifySubscription(query, readEnv);
}

// Kept for compatibility, but it can no longer bypass the guarded transport.
export async function sendWhatsapp(to: string, text: string): Promise<void> {
  await sendTextMessage(to, text);
}

// Legacy callers must not bypass authenticated, durable ingestion and a worker.
export async function processMessage(_message: unknown): Promise<void> {
  throw new Error("Webhook processing unavailable until durable worker integration is verified");
}

export async function handleWebhookRequest(req: Request): Promise<Response> {
  return guarded(req);
}

export interface RawWebhookContext {
  headers: HeadersInit;
  rawBody: Uint8Array;
}

/**
 * Backward-compatible signature; parsedBody is intentionally ignored for POST.
 * A framework MUST capture exact wire bytes before its JSON parser. Supplying
 * JSON.stringify(parsedBody) is not an acceptable substitute for rawBody.
 */
export async function handleWebhook(
  method: string,
  query: Record<string, unknown>,
  _parsedBody: unknown,
  context?: RawWebhookContext,
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  const headers = { "Cache-Control": "no-store" };
  if (method === "GET") {
    const result = verifyWebhook(query);
    return result.challenge !== undefined
      ? { status: 200, body: result.challenge, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" } }
      : { status: result.error === "verification_unconfigured" ? 503 : 403, body: { error: result.error }, headers };
  }
  if (method !== "POST") return { status: 405, body: { error: "method_not_allowed" }, headers: { ...headers, Allow: "GET, POST" } };
  if (!context || !(context.rawBody instanceof Uint8Array)) return { status: 400, body: { error: "raw_body_required" }, headers };
  try {
    const request = new Request("https://webhook.invalid/", {
      method: "POST", headers: context.headers, body: new Uint8Array(context.rawBody),
    });
    const response = await guarded(request);
    return { status: response.status, body: await response.json(), headers: Object.fromEntries(response.headers) };
  } catch {
    return { status: 400, body: { error: "request_invalid" }, headers };
  }
}
