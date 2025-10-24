import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { getSupabaseServiceConfig, optionalEnv } from "../_shared/env.ts";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "providers-email-send" });

const EMAIL_OFFLINE = optionalEnv("PROVIDERS_EMAIL_OFFLINE") === "1";

const BASE_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Accept-Profile": "supplier_crm",
} as const;

const JSON_HEADERS = {
  ...BASE_HEADERS,
  "Content-Type": "application/json",
  "Content-Profile": "supplier_crm",
  Prefer: "return=representation",
} as const;

interface ContactRow {
  id: string;
  provider_id: string | null;
  full_name?: string | null;
  email?: string | null;
}

interface ThreadRow {
  id: string;
  provider_id: string | null;
  contact_id: string | null;
  subject: string;
  promise_column: string | null;
}

interface MessageRow {
  id: string;
}

interface ProviderRow {
  id: string;
}

interface SendPayload {
  contact_id?: unknown;
  provider_id?: unknown;
  thread_id?: unknown;
  subject?: unknown;
  body?: unknown;
  to?: unknown;
  promise_column?: unknown;
  attachments?: unknown;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("providers-email-send");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  let payload: SendPayload;
  try {
    payload = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const subject = typeof payload.subject === "string"
    ? payload.subject.trim()
    : "";
  const body = typeof payload.body === "string"
    ? payload.body.trim()
    : "";
  const to = typeof payload.to === "string" ? payload.to.trim() : "";
  const promiseColumn = typeof payload.promise_column === "string"
    ? payload.promise_column.trim()
    : null;

  if (!subject || !body) {
    return jsonResponse({ ok: false, error: "subject and body are required" }, 400);
  }
  if (!to || !isLikelyEmail(to)) {
    return jsonResponse({ ok: false, error: "valid to email required" }, 400);
  }

  const contactIdRaw = typeof payload.contact_id === "string"
    ? payload.contact_id.trim()
    : "";
  const providerIdRaw = typeof payload.provider_id === "string"
    ? payload.provider_id.trim()
    : "";
  const threadIdRaw = typeof payload.thread_id === "string"
    ? payload.thread_id.trim()
    : "";

  if (contactIdRaw && !isUuid(contactIdRaw)) {
    return jsonResponse({ ok: false, error: "contact_id must be UUID" }, 400);
  }
  if (providerIdRaw && !isUuid(providerIdRaw)) {
    return jsonResponse({ ok: false, error: "provider_id must be UUID" }, 400);
  }
  if (threadIdRaw && !isUuid(threadIdRaw)) {
    return jsonResponse({ ok: false, error: "thread_id must be UUID" }, 400);
  }

  const contact = contactIdRaw ? await fetchContact(contactIdRaw) : null;
  if (contactIdRaw && !contact) {
    return jsonResponse({ ok: false, error: "contact not found" }, 404);
  }

  let providerId = providerIdRaw || contact?.provider_id || null;
  if (!providerId) {
    return jsonResponse({ ok: false, error: "provider_id required" }, 400);
  }
  providerId = providerId.trim();

  const provider = await fetchProvider(providerId);
  if (!provider) {
    return jsonResponse({ ok: false, error: "provider not found" }, 404);
  }

  const sentAt = new Date().toISOString();
  const channel = "email";

  const thread = await ensureThread({
    threadId: threadIdRaw || null,
    providerId,
    contactId: contact?.id ?? null,
    subject,
    promiseColumn,
    sentAt,
  });

  const attachmentsCount = Array.isArray(payload.attachments)
    ? payload.attachments.length
    : 0;

  const message = await insertMessage({
    threadId: thread.id,
    providerId,
    contactId: contact?.id ?? null,
    subject,
    body,
    sentAt,
    requestId,
    attachmentsCount,
  });

  await Promise.all([
    updateThreadTimestamps(thread.id, { sentAt, promiseColumn }),
    contact?.id
      ? updateContactLastOutbound(contact.id, sentAt)
      : Promise.resolve(),
    updateProviderLastContacted(providerId, sentAt),
  ]);

  const mode = EMAIL_OFFLINE ? "mock" : "recorded";

  console.log(JSON.stringify({
    level: "AUDIT",
    event: "providers.email.send",
    fn: "providers-email-send",
    requestId,
    providerId,
    contactId: contact?.id ?? null,
    threadId: thread.id,
    mode,
    promiseColumn: promiseColumn ?? thread.promise_column,
  }));

  return jsonResponse({
    ok: true,
    mode,
    thread_id: thread.id,
    message_id: message.id,
    provider_id: providerId,
    contact_id: contact?.id ?? null,
    sent_at: sentAt,
    request_id: requestId,
  });
}, { fn: "providers-email-send", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

async function fetchContact(contactId: string): Promise<ContactRow | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/supplier_crm.contacts?id=eq.${encodeURIComponent(contactId)}&select=id,provider_id,full_name,email&limit=1`,
    { headers: BASE_HEADERS },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to load contact: ${text}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    return null;
  }
  return rows[0] as ContactRow;
}

async function fetchProvider(providerId: string): Promise<ProviderRow | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/supplier_crm.providers?id=eq.${encodeURIComponent(providerId)}&select=id&limit=1`,
    { headers: BASE_HEADERS },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to load provider: ${text}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    return null;
  }
  return rows[0] as ProviderRow;
}

async function ensureThread(input: {
  threadId: string | null;
  providerId: string;
  contactId: string | null;
  subject: string;
  promiseColumn: string | null;
  sentAt: string;
}): Promise<ThreadRow> {
  if (input.threadId) {
    const existing = await fetchThread(input.threadId);
    if (existing) {
      return existing;
    }
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/supplier_crm.threads`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        provider_id: input.providerId,
        contact_id: input.contactId,
        subject: input.subject,
        channel: "email",
        status: "open",
        promise_column: input.promiseColumn,
        last_outbound_at: input.sentAt,
        updated_at: input.sentAt,
      }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create thread: ${text}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    throw new Error("Thread creation returned no rows");
  }
  return rows[0] as ThreadRow;
}

async function fetchThread(threadId: string): Promise<ThreadRow | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/supplier_crm.threads?id=eq.${encodeURIComponent(threadId)}&select=id,provider_id,contact_id,subject,promise_column&limit=1`,
    { headers: BASE_HEADERS },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to load thread: ${text}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    return null;
  }
  return rows[0] as ThreadRow;
}

async function insertMessage(input: {
  threadId: string;
  providerId: string;
  contactId: string | null;
  subject: string;
  body: string;
  sentAt: string;
  requestId: string;
  attachmentsCount: number;
}): Promise<MessageRow> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/supplier_crm.messages`,
    {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        thread_id: input.threadId,
        provider_id: input.providerId,
        contact_id: input.contactId,
        direction: "outbound",
        subject: input.subject,
        body: input.body,
        sent_at: input.sentAt,
        delivery_status: EMAIL_OFFLINE ? "mock" : "recorded",
        metadata: {
          request_id: input.requestId,
          attachments_count: input.attachmentsCount,
          offline: EMAIL_OFFLINE,
        },
      }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to insert message: ${text}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    throw new Error("Message insert returned no rows");
  }
  return rows[0] as MessageRow;
}

async function updateThreadTimestamps(
  threadId: string,
  input: { sentAt: string; promiseColumn: string | null },
) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/supplier_crm.threads?id=eq.${encodeURIComponent(threadId)}`,
    {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        last_outbound_at: input.sentAt,
        updated_at: input.sentAt,
        promise_column: input.promiseColumn ?? undefined,
      }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update thread: ${text}`);
  }
}

async function updateContactLastOutbound(contactId: string, sentAt: string) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/supplier_crm.contacts?id=eq.${encodeURIComponent(contactId)}`,
    {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        last_outbound_at: sentAt,
        updated_at: sentAt,
      }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update contact: ${text}`);
  }
}

async function updateProviderLastContacted(providerId: string, sentAt: string) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/supplier_crm.providers?id=eq.${encodeURIComponent(providerId)}`,
    {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        last_contacted_at: sentAt,
        updated_at: sentAt,
      }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update provider: ${text}`);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/u.test(value);
}

function isLikelyEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value);
}
