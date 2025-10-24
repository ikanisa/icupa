import { getSupabaseServiceConfig, optionalEnv, requireEnv } from "./env.ts";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "whatsapp" });

const WA_OFFLINE = optionalEnv("WA_OFFLINE") === "1";
const WA_GRAPH_BASE = optionalEnv("WA_GRAPH_BASE") ??
  "https://graph.facebook.com/v20.0";
const WA_ACCESS_TOKEN = requireEnv("WA_ACCESS_TOKEN", {
  allowEmpty: true,
  context: "whatsapp",
});
const WA_PHONE_ID = requireEnv("WA_PHONE_ID", {
  allowEmpty: true,
  context: "whatsapp",
});

export interface StoreMessageInput {
  userWa: string;
  direction: "in" | "out";
  sessionId?: string | null;
  userId?: string | null;
  channel?: string;
  body: Record<string, unknown>;
  waMessageId?: string | null;
}

export interface TemplateButton {
  id: string;
  text: string;
}

export interface TemplateComponents {
  body_text: string;
  buttons?: TemplateButton[];
  vars?: Record<string, string>;
}

export interface TemplateMessage {
  name: string;
  language?: string;
  components: TemplateComponents;
}

export interface SendWhatsAppOptions {
  to: string;
  text?: string;
  template?: TemplateMessage;
  sessionId?: string | null;
  userWa?: string | null;
  requestId?: string;
}

export interface SendWhatsAppResult {
  ok: boolean;
  mode: "mock" | "live" | "mock_template" | "live_template";
  message_id: string;
}

export interface ChatStateRecord {
  state: string;
  data: Record<string, unknown>;
}

export async function messageExists(waMessageId: string | null | undefined): Promise<boolean> {
  if (!waMessageId) return false;
  const response = await callRpc("agent_message_exists", { p_wa_message_id: waMessageId });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`agent_message_exists failed: ${text}`);
  }
  const data = await response.json();
  if (Array.isArray(data)) {
    return Boolean(data[0]);
  }
  return Boolean(data);
}

export async function getLatestSession(userWa: string): Promise<string | null> {
  const response = await callRpc("agent_latest_session", { p_user_wa: userWa });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`agent_latest_session failed: ${text}`);
  }
  const data = await response.json();
  if (!data) return null;
  if (typeof data === "string") return data;
  if (Array.isArray(data) && data[0]) return String(data[0]);
  if (data && typeof data === "object" && "session_id" in data) {
    return String((data as Record<string, unknown>).session_id ?? "");
  }
  return null;
}

export async function storeMessage(input: StoreMessageInput) {
  const response = await callRpc("agent_store_message", {
    p_user_wa: input.userWa,
    p_user: input.userId ?? null,
    p_session: input.sessionId ?? null,
    p_direction: input.direction,
    p_channel: input.channel ?? "whatsapp",
    p_body: input.body ?? {},
    p_wa_message_id: input.waMessageId ?? null
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`agent_store_message failed: ${text}`);
  }
  const stored = await response.json();
  await maybeEmitChatEvent(stored, input);
}

export async function sendWhatsAppMessage(options: SendWhatsAppOptions): Promise<SendWhatsAppResult> {
  const requestId = options.requestId ?? crypto.randomUUID();
  const userWa = options.userWa ?? options.to;
  const sessionId = options.sessionId ?? null;

  if (options.template) {
    return await sendTemplateMessage({
      options,
      requestId,
      userWa,
      sessionId
    });
  }

  const textBody = options.text?.trim() ?? "";
  if (!textBody) {
    throw new Error("text or template payload required");
  }

  if (WA_OFFLINE || !WA_ACCESS_TOKEN || !WA_PHONE_ID) {
    const mockId = `wamid.mock-${crypto.randomUUID()}`;
    await storeMessage({
      userWa,
      direction: "out",
      sessionId,
      body: {
        text: textBody,
        mode: "mock",
        request_id: requestId
      },
      waMessageId: mockId
    });
    console.log(
      `AUDIT wa.send requestId=${requestId} to=${userWa} mode=mock message=${JSON.stringify(textBody)}`
    );
    return { ok: true, mode: "mock", message_id: mockId };
  }

  const payload = {
    messaging_product: "whatsapp",
    to: options.to,
    type: "text",
    text: { body: textBody }
  };

  try {
    const url = `${WA_GRAPH_BASE.replace(/\/$/, "")}/${WA_PHONE_ID}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${WA_ACCESS_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`WA send error: ${text}`);
    }

    const data = await response.json();
    const messageId = String(data?.messages?.[0]?.id ?? `wamid.${crypto.randomUUID()}`);

    await storeMessage({
      userWa,
      direction: "out",
      sessionId,
      body: {
        text: textBody,
        mode: "live",
        request_id: requestId,
        payload
      },
      waMessageId: messageId
    });

    console.log(
      `AUDIT wa.send requestId=${requestId} to=${userWa} mode=live message_id=${messageId}`
    );
    return { ok: true, mode: "live", message_id: messageId };
  } catch (error) {
    console.warn(`WA send fallback: ${String(error)}`);
    const mockId = `wamid.mock-${crypto.randomUUID()}`;
    await storeMessage({
      userWa,
      direction: "out",
      sessionId,
      body: {
        text: textBody,
        mode: "mock",
        request_id: requestId,
        error: String(error)
      },
      waMessageId: mockId
    });
    return { ok: true, mode: "mock", message_id: mockId };
  }
}

async function sendTemplateMessage(input: {
  options: SendWhatsAppOptions;
  requestId: string;
  userWa: string;
  sessionId: string | null;
}): Promise<SendWhatsAppResult> {
  const { options, requestId, userWa, sessionId } = input;
  const template = options.template!;
  const language = template.language ?? "en";
  const buttons = template.components.buttons ?? [];
  const vars = template.components.vars ?? {};

  const templateBodyRecord: Record<string, unknown> = {
    name: template.name,
    language,
    body_text: template.components.body_text,
    buttons,
    vars
  };

  if (WA_OFFLINE || !WA_ACCESS_TOKEN || !WA_PHONE_ID) {
    const mockId = `wamid.mock-${crypto.randomUUID()}`;
    await storeMessage({
      userWa,
      direction: "out",
      sessionId,
      body: {
        template: templateBodyRecord,
        mode: "mock_template",
        request_id: requestId
      },
      waMessageId: mockId
    });
    console.log(
      `AUDIT wa.send template=${template.name} requestId=${requestId} to=${userWa} mode=mock`
    );
    return { ok: true, mode: "mock_template", message_id: mockId };
  }

  const components: Array<Record<string, unknown>> = [];
  components.push({
    type: "body",
    parameters: [
      {
        type: "text",
        text: template.components.body_text
      },
      ...Object.values(vars ?? {}).map((value) => ({
        type: "text",
        text: value
      }))
    ]
  });

  buttons.forEach((button, index) => {
    components.push({
      type: "button",
      sub_type: "quick_reply",
      index: String(index),
      parameters: [
        {
          type: "payload",
          payload: button.id
        }
      ]
    });
  });

  const payload = {
    messaging_product: "whatsapp",
    to: options.to,
    type: "template",
    template: {
      name: template.name,
      language: { code: language },
      components
    }
  };

  try {
    const url = `${WA_GRAPH_BASE.replace(/\/$/, "")}/${WA_PHONE_ID}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${WA_ACCESS_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`WA template send error: ${text}`);
    }

    const data = await response.json();
    const messageId = String(data?.messages?.[0]?.id ?? `wamid.${crypto.randomUUID()}`);

    await storeMessage({
      userWa,
      direction: "out",
      sessionId,
      body: {
        template: templateBodyRecord,
        mode: "live_template",
        request_id: requestId,
        payload
      },
      waMessageId: messageId
    });

    console.log(
      `AUDIT wa.send template=${template.name} requestId=${requestId} to=${userWa} mode=live`
    );
    return { ok: true, mode: "live_template", message_id: messageId };
  } catch (error) {
    console.warn(`WA template send fallback: ${String(error)}`);
    const mockId = `wamid.mock-${crypto.randomUUID()}`;
    await storeMessage({
      userWa,
      direction: "out",
      sessionId,
      body: {
        template: templateBodyRecord,
        mode: "mock_template",
        request_id: requestId,
        error: String(error)
      },
      waMessageId: mockId
    });
    console.log(
      `AUDIT wa.send template=${template.name} requestId=${requestId} to=${userWa} mode=mock`
    );
    return { ok: true, mode: "mock_template", message_id: mockId };
  }
}

export async function getChatState(userWa: string): Promise<ChatStateRecord | null> {
  const response = await callRpc("agents_get_chat_state", { p_user_wa: userWa });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`chat_state fetch failed: ${text}`);
  }
  const payload = await response.json();
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row) {
    return null;
  }
  const stateValue = typeof row.state === "string" ? row.state : "idle";
  const dataValue = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  return { state: stateValue, data: dataValue };
}

export async function upsertChatState(
  userWa: string,
  state: string,
  data: Record<string, unknown> | null
): Promise<void> {
  const payload: Record<string, unknown> = {
    p_user_wa: userWa,
    p_state: state,
    p_data: data ?? null
  };
  const response = await callRpc("agents_upsert_chat_state", payload);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`upsert_chat_state failed: ${text}`);
  }
  await response.text();
}

function serviceHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`
  };
}

async function callRpc(name: string, body: Record<string, unknown>) {
  return await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      ...serviceHeaders(),
      "Content-Type": "application/json",
      Prefer: "params=single-object"
    },
    body: JSON.stringify(body)
  });
}

async function maybeEmitChatEvent(record: unknown, input: StoreMessageInput) {
  const sessionId = resolveSessionId(record) ?? input.sessionId ?? null;
  if (!sessionId) return;

  const payload: Record<string, unknown> = {
    direction: input.direction,
    channel: input.channel ?? "whatsapp",
    wa_message_id: input.waMessageId ?? null,
  };

  if (input.body && typeof input.body === "object" && !Array.isArray(input.body)) {
    const bodyRecord = input.body as Record<string, unknown>;
    const maybeText = bodyRecord.text;
    if (typeof maybeText === "string" && maybeText.trim()) {
      payload.excerpt = maybeText.trim().slice(0, 160);
    }
    const maybeState = bodyRecord.state_after;
    if (typeof maybeState === "string") {
      payload.state_after = maybeState;
    }
  }

  try {
    const response = await callRpc("agent_insert_event", {
      p_session: sessionId,
      p_level: "AUDIT",
      p_event: `chat.message.${input.direction === "out" ? "outbound" : "inbound"}`,
      p_payload: payload,
    });
    if (!response.ok) {
      const text = await response.text();
      console.log(
        `WARN chat.event_insert_failed session=${sessionId} status=${response.status} message=${text}`,
      );
    } else {
      await response.json().catch(() => null);
    }
  } catch (error) {
    console.log(
      `WARN chat.event_exception session=${sessionId} message=${String(error)}`,
    );
  }
}

function resolveSessionId(record: unknown): string | null {
  if (!record || typeof record !== "object") return null;
  if (Array.isArray(record)) {
    return resolveSessionId(record[0]);
  }
  const value = (record as Record<string, unknown>).session_id;
  return typeof value === "string" && value ? value : null;
}
