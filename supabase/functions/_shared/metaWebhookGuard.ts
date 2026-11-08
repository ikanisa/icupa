/**
 * Shared Meta webhook trust boundary; no SDK, network, database or AI calls.
 * Default adapters intentionally have NO durable inbox: valid POSTs return 503.
 * Never acknowledge delivery until the entire envelope is durably committed.
 */
export type ReadEnv = (name: string) => string | undefined;
export type Payload = Record<string, unknown>;
export interface DurableInbox {
  /**
   * SERVER-INJECTED adapter only. Must commit the entire envelope atomically,
   * persist across restarts and deduplicate event identities across envelopes.
   * bodySha256 is an integrity value, NOT a sufficient event-idempotency key.
   * Do not call AI or send messages here. Reconcile ambiguous commits on retry.
   */
  persist(envelope: { rawBody: Uint8Array; payload: Payload; bodySha256: string }):
    Promise<{ committed: true }>;
}
export const MAX_WEBHOOK_BYTES = 1_048_576;
const READ_TIMEOUT_MS = 10_000;
// Only the Togo sender is definitively retired. The Rwanda sender is
// subject to the exact WABA:phone allowlist, not hard-coded retirement.
const RETIRED = new Set(["396791596844039", "22893002751"]);
const encoder = new TextEncoder();
function object(value: unknown): value is Payload {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function answer(status: number, code: string): Response {
  return new Response(JSON.stringify({ error: { code } }), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...(status === 405 ? { Allow: "GET, POST" } : {}) },
  });
}
export function verifySubscription(query: Record<string, unknown>, readEnv: ReadEnv):
  { challenge?: string; error?: string } {
  const expected = readEnv("WA_VERIFY_TOKEN");
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];
  if (!expected || !expected.trim()) return { error: "verification_unconfigured" };
  if (query["hub.mode"] !== "subscribe" || typeof token !== "string" || !token || token !== expected ||
      typeof challenge !== "string" || !challenge || challenge.length > 256 || /[\r\n\0]/.test(challenge)) {
    return { error: "verification_failed" };
  }
  return { challenge };
}
class ReadFailure extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
async function readBounded(req: Request): Promise<Uint8Array> {
  const declared = req.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)))) {
    throw new ReadFailure(400, "content_length_invalid");
  }
  if (declared !== null && Number(declared) > MAX_WEBHOOK_BYTES) throw new ReadFailure(413, "payload_too_large");
  if (!req.body) throw new ReadFailure(400, "body_required");
  const reader = req.body.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new ReadFailure(408, "body_timeout")), READ_TIMEOUT_MS);
  });
  try {
    for (;;) {
      const next = await Promise.race([reader.read(), timeout]);
      if (next.done) { finished = true; break; }
      length += next.value.byteLength;
      if (length > MAX_WEBHOOK_BYTES) throw new ReadFailure(413, "payload_too_large");
      parts.push(next.value);
    }
  } finally {
    clearTimeout(timer);
    // Do not await untrusted stream cancellation, which itself can hang.
    if (!finished) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (!length) throw new ReadFailure(400, "body_required");
  if (declared !== null && Number(declared) !== length) throw new ReadFailure(400, "content_length_mismatch");
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.byteLength; }
  return result;
}
function bindings(readEnv: ReadEnv): Set<string> | null {
  const raw = readEnv("WA_WEBHOOK_ALLOWED_BINDINGS") ?? "";
  const values = raw.split(",").map(x => x.trim());
  if (!raw.trim() || values.some(x => !/^[0-9]{5,30}:[0-9]{5,30}$/.test(x))) return null;
  return new Set(values);
}
function inspectEnvelope(payload: unknown, allowed: Set<string>): string | null {
  if (!object(payload) || payload.object !== "whatsapp_business_account" ||
      !Array.isArray(payload.entry) || !payload.entry.length || payload.entry.length > 1000) return "payload_invalid";
  let events = 0;
  for (const entry of payload.entry) {
    if (!object(entry) || typeof entry.id !== "string" || !/^[0-9]{5,30}$/.test(entry.id) ||
        !Array.isArray(entry.changes) || !entry.changes.length) return "payload_invalid";
    for (const change of entry.changes) {
      // Other webhook field types require their own explicitly reviewed handler.
      if (!object(change) || change.field !== "messages" || !object(change.value)) return "unsupported_event";
      const value = change.value;
      if (value.messaging_product !== "whatsapp" || !object(value.metadata) ||
          typeof value.metadata.phone_number_id !== "string") return "payload_invalid";
      const phone = value.metadata.phone_number_id;
      if (RETIRED.has(phone)) return "retired_sender_blocked";
      if (!allowed.has(`${entry.id}:${phone}`)) return "asset_not_allowlisted";
      if (value.messages === undefined && value.statuses === undefined) return "unsupported_event";
      for (const type of ["messages", "statuses"]) {
        const rows = value[type];
        if (rows === undefined) continue;
        if (!Array.isArray(rows) || !rows.length) return "payload_invalid";
        for (const event of rows) {
          if (!object(event) || typeof event.id !== "string" || !event.id || event.id.length > 1024) return "payload_invalid";
          if (type === "messages" && (typeof event.type !== "string" || !event.type)) return "payload_invalid";
          if (type === "statuses" && (typeof event.status !== "string" || !event.status)) return "payload_invalid";
          if (++events > 1000) return "too_many_events";
        }
      }
    }
  }
  return events ? null : "payload_invalid";
}
/** Exact-byte HMAC verification. JSON reserialization is NEVER a signature input. */
export function createMetaWebhookHandler(readEnv: ReadEnv, inbox?: DurableInbox) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method === "GET") {
      const params = new URL(req.url).searchParams;
      const query: Record<string, unknown> = {};
      for (const key of ["hub.mode", "hub.verify_token", "hub.challenge"]) {
        if (params.getAll(key).length !== 1) return answer(403, "verification_failed");
        query[key] = params.get(key);
      }
      const result = verifySubscription(query, readEnv);
      if (result.challenge === undefined) return answer(result.error === "verification_unconfigured" ? 503 : 403, result.error!);
      return new Response(result.challenge, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }
    if (req.method !== "POST") return answer(405, "method_not_allowed");
    const secret = readEnv("WA_APP_SECRET");
    if (!secret || !secret.trim()) return answer(503, "signing_unconfigured");
    const signature = req.headers.get("x-hub-signature-256");
    if (!signature || !/^sha256=[a-fA-F0-9]{64}$/.test(signature)) return answer(401, "signature_invalid");
    const media = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (media !== "application/json" || ![null, "identity"].includes(req.headers.get("content-encoding"))) return answer(415, "unsupported_media");
    let raw: Uint8Array;
    try { raw = await readBounded(req); }
    catch (error) { return error instanceof ReadFailure ? answer(error.status, error.code) : answer(400, "body_unreadable"); }
    try {
      const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
      const digest = new Uint8Array(signature.slice(7).match(/../g)!.map(x => parseInt(x, 16)));
      if (!await crypto.subtle.verify("HMAC", key, digest, raw)) return answer(401, "signature_invalid");
    } catch { return answer(503, "signature_check_unavailable"); }
    let payload: unknown;
    try { payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)); }
    catch { return answer(400, "payload_invalid"); }
    const allowed = bindings(readEnv);
    if (!allowed) return answer(503, "asset_bindings_unconfigured");
    const invalid = inspectEnvelope(payload, allowed);
    if (invalid) return answer(invalid === "retired_sender_blocked" || invalid === "asset_not_allowlisted" ? 403 : 422, invalid);
    // Neither a flag nor a successful signature substitutes for durable receipt.
    if (readEnv("WA_WEBHOOK_INGESTION_ENABLED") !== "true" || !inbox) return answer(503, "webhook_processing_unavailable");
    try {
      const hash = await crypto.subtle.digest("SHA-256", raw);
      const bodySha256 = Array.from(new Uint8Array(hash)).map(x => x.toString(16).padStart(2, "0")).join("");
      const receipt = await inbox.persist({ rawBody: raw, payload: payload as Payload, bodySha256 });
      if (!receipt || receipt.committed !== true) return answer(503, "durable_receipt_unconfirmed");
    } catch { return answer(503, "durable_receipt_unconfirmed"); }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  };
}
