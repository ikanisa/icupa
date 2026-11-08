/**
 * Fail-closed WhatsApp transport for the account-recovery period.
 * A local enable flag is NOT evidence of Meta reinstatement or recipient consent.
 * Keep outbound disabled until the external restoration and deployment gates pass.
 * Never log tokens, recipient data, message bodies or raw provider errors.
 */

type Outcome = "not_dispatched" | "rejected" | "unknown";
export class WhatsAppTransportError extends Error {
  readonly code: string;
  readonly outcome: Outcome;
  readonly httpStatus?: number;
  constructor(code: string, outcome: Outcome, httpStatus?: number) {
    super(`WhatsApp request unavailable (${code})`);
    this.name = "WhatsAppTransportError";
    this.code = code;
    this.outcome = outcome;
    this.httpStatus = httpStatus;
  }
}

// Rwanda 561637583695258 is no longer presumed permanently retired.
// It remains disabled by default and needs explicit allowlisting + verified Meta approval.
const RETIRED_SENDER_IDS = new Set(["396791596844039"]);
// Also reject phone digits accidentally configured in place of a phone-number ID.
const RETIRED_PHONE_DIGITS = new Set(["22893002751"]);
const REQUEST_TIMEOUT_MS = 15_000;

function reject(code: string): never {
  throw new WhatsAppTransportError(code, "not_dispatched");
}

function config(): { endpoint: string; token: string } {
  // Read every call: incident operators can pause subsequent calls without a
  // module reload. This does not cancel a request already accepted by Meta.
  if (process.env.WA_OUTBOUND_ENABLED !== "true") reject("outbound_paused");
  const base = (process.env.WA_API_BASE ?? "").trim().replace(/\/$/, "");
  const sender = (process.env.WA_PHONE_NUMBER_ID ?? "").trim();
  const token = (process.env.WA_ACCESS_TOKEN ?? "").trim();
  if (!base || !sender || !token) reject("configuration_missing");
  // No fallback to the former hardcoded API version, arbitrary host, query,
  // userinfo or redirects that could disclose the bearer credential.
  if (!/^https:\/\/graph\.facebook\.com\/v[1-9][0-9]{0,2}\.0$/.test(base)) {
    reject("api_base_invalid");
  }
  if (!/^[0-9]{5,30}$/.test(sender)) reject("sender_id_invalid");
  if (RETIRED_SENDER_IDS.has(sender) || RETIRED_PHONE_DIGITS.has(sender)) {
    reject("retired_sender_blocked");
  }
  const allowed = (process.env.WA_ALLOWED_SENDER_IDS ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  if (!allowed.includes(sender)) reject("sender_not_allowlisted");
  if (/\s/.test(token)) reject("credential_format_invalid");
  return { endpoint: `${base}/${sender}/messages`, token };
}

function recipient(input: string): string {
  if (typeof input !== "string") reject("recipient_invalid");
  const value = input.trim();
  if (!/^\+?[1-9][0-9]{6,14}$/.test(value)) reject("recipient_invalid");
  return value.replace(/^\+/, "");
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function dispatch(payload: Record<string, unknown>): Promise<unknown> {
  const { endpoint, token } = config();
  let body: string;
  try {
    body = JSON.stringify(payload);
  } catch {
    return reject("payload_invalid");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
    });
    if (!response.ok) {
      // A 5xx response may follow processing: do not automatically resend.
      throw new WhatsAppTransportError(
        "provider_http_error", response.status >= 500 ? "unknown" : "rejected", response.status,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new WhatsAppTransportError("provider_response_invalid", "unknown");
    }
  } catch (error) {
    if (error instanceof WhatsAppTransportError) throw error;
    // Timeouts, resets and redirects do not establish whether Meta processed
    // the request. Reconciliation is required; there is deliberately no retry.
    throw new WhatsAppTransportError("transport_outcome_unknown", "unknown");
  } finally {
    clearTimeout(timer);
  }
}

function acceptedMessage(result: unknown): { messageId: string } {
  if (!record(result) || !Array.isArray(result.messages) || !record(result.messages[0])) {
    throw new WhatsAppTransportError("message_receipt_missing", "unknown");
  }
  const id = result.messages[0].id;
  if (typeof id !== "string" || !id.trim()) {
    throw new WhatsAppTransportError("message_receipt_missing", "unknown");
  }
  // Acceptance is not a delivery/read receipt. Confirm those through webhooks.
  return { messageId: id };
}

/** Caller must enforce authorisation, opt-in and the customer-service window. */
export async function sendTextMessage(to: string, text: string): Promise<{ messageId: string }> {
  config();
  if (process.env.WA_ALLOW_SESSION_TEXT !== "true") reject("session_text_paused");
  const destination = recipient(to);
  if (typeof text !== "string" || !text.trim() || text.length > 4096) reject("text_invalid");
  return acceptedMessage(await dispatch({
    messaging_product: "whatsapp", to: destination, type: "text", text: { body: text },
  }));
}

/** Allowlisting does not itself establish Meta approval or valid recipient opt-in. */
export async function sendTemplateMessage(
  to: string, templateName: string, languageCode: string = "en", components?: unknown[],
): Promise<{ messageId: string }> {
  config();
  const destination = recipient(to);
  if (typeof templateName !== "string" || !/^[a-z0-9_]{1,512}$/.test(templateName)) {
    reject("template_invalid");
  }
  const allowed = (process.env.WA_ALLOWED_TEMPLATE_NAMES ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  if (!allowed.includes(templateName)) reject("template_not_allowlisted");
  if (typeof languageCode !== "string" || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(languageCode)) {
    reject("language_invalid");
  }
  if (components !== undefined && !Array.isArray(components)) reject("components_invalid");
  return acceptedMessage(await dispatch({
    messaging_product: "whatsapp", to: destination, type: "template",
    template: { name: templateName, language: { code: languageCode }, components: components ?? [] },
  }));
}

/** Caller must bind message ownership; this helper does not authenticate users. */
export async function markAsRead(messageId: string): Promise<void> {
  config();
  if (typeof messageId !== "string" || !messageId.trim() || messageId.length > 2048) {
    reject("message_id_invalid");
  }
  const result = await dispatch({ messaging_product: "whatsapp", status: "read", message_id: messageId });
  if (!record(result) || result.success !== true) {
    throw new WhatsAppTransportError("read_receipt_missing", "unknown");
  }
}
