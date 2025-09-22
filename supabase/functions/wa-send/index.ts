import { sendWhatsAppMessage } from "../_shared/wa.ts";
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Supabase configuration missing for wa-send");
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("wa-send");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  if (!authorize(req)) {
    return jsonResponse({ ok: false, error: "forbidden" }, 403);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const to = typeof payload.to === "string" ? payload.to.trim() : "";
  const type = typeof payload.type === "string"
    ? payload.type.trim().toLowerCase()
    : "text";
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const linkUrl = typeof payload.url === "string" ? payload.url.trim() : "";
  const sessionId = typeof payload.session_id === "string"
    ? payload.session_id
    : undefined;
  const userWa = typeof payload.user_wa === "string" ? payload.user_wa : to;

  let templatePayload: {
    name: string;
    language?: string;
    components: {
      body_text: string;
      buttons?: Array<{ id: string; text: string }>;
      vars?: Record<string, string>;
    };
  } | null = null;

  if (type === "template") {
    const template = payload.template as Record<string, unknown> | undefined;
    const name = typeof template?.name === "string" ? template.name.trim() : "";
    const language = typeof template?.language === "string"
      ? template.language.trim()
      : undefined;
    const components = template?.components as
      | Record<string, unknown>
      | undefined;
    const bodyText = typeof components?.body_text === "string"
      ? components.body_text.trim()
      : "";
    const buttonsRaw = Array.isArray(components?.buttons)
      ? components?.buttons
      : [];
    const varsRaw = components?.vars as Record<string, unknown> | undefined;

    const buttons = buttonsRaw
      .map((btn) => {
        if (!btn || typeof btn !== "object") return null;
        const id = typeof (btn as Record<string, unknown>).id === "string"
          ? (btn as Record<string, unknown>).id.trim()
          : "";
        const title = typeof (btn as Record<string, unknown>).text === "string"
          ? (btn as Record<string, unknown>).text.trim()
          : "";
        if (!id || !title) return null;
        return { id, text: title };
      })
      .filter((btn): btn is { id: string; text: string } => Boolean(btn));

    const vars: Record<string, string> | undefined = varsRaw
      ? Object.entries(varsRaw).reduce<Record<string, string>>(
        (acc, [key, value]) => {
          if (typeof value === "string") {
            acc[key] = value;
          }
          return acc;
        },
        {},
      )
      : undefined;

    if (!to || !name || !bodyText) {
      return jsonResponse({
        ok: false,
        error:
          "template send requires to, template.name, and components.body_text",
      }, 400);
    }

    templatePayload = {
      name,
      language,
      components: {
        body_text: bodyText,
        buttons: buttons.length ? buttons : undefined,
        vars,
      },
    };
  }

  if (!to) {
    return jsonResponse({ ok: false, error: "to is required" }, 400);
  }

  let messageText = text;

  if (type === "link_notice") {
    if (!text || !linkUrl) {
      return jsonResponse({
        ok: false,
        error: "link_notice requires text and url",
      }, 400);
    }
    messageText = `${text}\n${linkUrl}`;
  }

  if (!templatePayload && !messageText) {
    return jsonResponse({
      ok: false,
      error: "text or template payload required",
    }, 400);
  }

  try {
    const result = await sendWhatsAppMessage({
      to,
      text: templatePayload ? undefined : messageText,
      template: templatePayload ?? undefined,
      sessionId,
      userWa,
      requestId,
    });

    return jsonResponse({
      ok: true,
      mode: result.mode,
      message_id: result.message_id,
    });
  } catch (error) {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    (wrapped as { code?: string }).code ??= ERROR_CODES.TRANSIENT_RETRY;
    throw wrapped;
  }
}, { fn: "wa-send", defaultErrorCode: ERROR_CODES.TRANSIENT_RETRY });

Deno.serve(handler);

function authorize(req: Request): boolean {
  const apiKeyHeader = req.headers.get("apikey") ?? "";
  return apiKeyHeader === SERVICE_ROLE_KEY;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
