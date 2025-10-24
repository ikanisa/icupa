import { getSupabaseServiceConfig } from "./env.ts";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "affiliate" });

const BASE_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Accept-Profile": "affiliate",
} as const;

const JSON_HEADERS = {
  ...BASE_HEADERS,
  "Content-Type": "application/json",
  "Content-Profile": "affiliate",
  Prefer: "return=representation",
} as const;

const SINGLE_HEADERS = {
  ...BASE_HEADERS,
  Prefer: "params=single-object",
} as const;

const encoder = new TextEncoder();

export interface AffiliatePartnerRow {
  id: string;
  slug: string;
  name: string | null;
  contact_email: string | null;
  signing_secret: string | null;
  active: boolean;
  metadata: Record<string, unknown> | null;
}

export interface AffiliateEventRow {
  id: string;
}

export type AffiliateEventDirection = "inbound" | "outbound";

export interface SignatureCheck {
  provided: string | null;
  computed: string | null;
  version: string | null;
  status: "valid" | "invalid" | "missing" | "skipped";
  error?: string | null;
  timestamp: string | null;
}

export interface SignatureOptions {
  header: string | null;
  timestampHeader: string | null;
  secret: string | null;
  payload: string;
}

export interface InsertEventOptions {
  partner: AffiliatePartnerRow | null;
  partnerSlug: string;
  direction: AffiliateEventDirection;
  eventType: string;
  requestId: string;
  signature: SignatureCheck;
  rawBody: string;
  payload: unknown;
  headers: Record<string, string | null>;
  metadata?: Record<string, unknown>;
}

export async function fetchAffiliatePartner(
  slug: string,
): Promise<AffiliatePartnerRow | null> {
  if (!slug) return null;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/affiliate.partner?slug=eq.${encodeURIComponent(slug)}&select=id,slug,name,contact_email,signing_secret,active,metadata&limit=1`,
    { headers: SINGLE_HEADERS },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to load affiliate partner: ${text || response.statusText}`);
  }

  if (response.status === 200) {
    try {
      const payload = await response.json();
      if (!payload || typeof payload !== "object") {
        return null;
      }
      const row = payload as Partial<AffiliatePartnerRow> & { id?: string };
      if (!row?.id) {
        return null;
      }
      return {
        id: row.id,
        slug: row.slug ?? slug,
        name: row.name ?? null,
        contact_email: row.contact_email ?? null,
        signing_secret: row.signing_secret ?? null,
        active: Boolean(row.active ?? true),
        metadata: (row.metadata && typeof row.metadata === "object") ? row.metadata as Record<string, unknown> : null,
      };
    } catch (_error) {
      return null;
    }
  }

  return null;
}

export async function verifyAffiliateSignature(
  options: SignatureOptions,
): Promise<SignatureCheck> {
  const parsed = parseSignatureHeader(options.header);
  const provided = parsed.signature ?? sanitize(options.header);
  const timestamp = options.timestampHeader?.trim() || parsed.timestamp;
  const version = parsed.version;

  if (!options.secret) {
    return {
      provided,
      computed: null,
      version,
      status: "missing",
      error: "signing secret missing",
      timestamp,
    };
  }

  if (!provided) {
    return {
      provided: null,
      computed: null,
      version,
      status: "missing",
      error: "signature header missing",
      timestamp,
    };
  }

  if (!timestamp) {
    return {
      provided,
      computed: null,
      version,
      status: "skipped",
      error: "timestamp missing",
      timestamp: null,
    };
  }

  const computed = await computeAffiliateSignature(options.secret, timestamp, options.payload);
  const match = timingSafeEqual(provided, computed);

  return {
    provided,
    computed,
    version,
    status: match ? "valid" : "invalid",
    error: match ? null : "signature mismatch",
    timestamp,
  };
}

export async function computeAffiliateSignature(
  secret: string,
  timestamp: string,
  payload: string,
): Promise<string> {
  const base = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(base));
  return toHex(signature);
}

export async function insertAffiliateEvent(
  options: InsertEventOptions,
): Promise<AffiliateEventRow> {
  const headersPayload = Object.fromEntries(
    Object.entries(options.headers ?? {}).map(([key, value]) => [key, value ?? null]),
  );

  const metadata = {
    ...options.metadata,
    computed_signature: options.signature.computed,
    signature_error: options.signature.error ?? null,
    signature_timestamp: options.signature.timestamp,
  } as Record<string, unknown>;

  const body = JSON.stringify({
    partner_id: options.partner?.id ?? null,
    partner_slug: options.partnerSlug,
    partner_name: options.partner?.name ?? null,
    direction: options.direction,
    event_type: options.eventType,
    request_id: options.requestId,
    signature_version: options.signature.version,
    signature: options.signature.provided,
    signature_status: options.signature.status,
    signature_error: options.signature.error ?? null,
    headers: headersPayload,
    payload: sanitizePayload(options.payload),
    raw_body: options.rawBody || null,
    metadata,
  });

  const response = await fetch(`${SUPABASE_URL}/rest/v1/affiliate.events`, {
    method: "POST",
    headers: JSON_HEADERS,
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to record affiliate event: ${text || response.statusText}`);
  }

  const rows = await response.json();
  if (Array.isArray(rows) && rows[0]) {
    return rows[0] as AffiliateEventRow;
  }

  if (rows && rows.id) {
    return rows as AffiliateEventRow;
  }

  throw new Error("Affiliate event insert returned no rows");
}

function parseSignatureHeader(header: string | null): {
  timestamp: string | null;
  version: string | null;
  signature: string | null;
} {
  if (!header) {
    return { timestamp: null, version: null, signature: null };
  }

  const parts = header.split(",").map((part) => part.trim()).filter(Boolean);
  let timestamp: string | null = null;
  let version: string | null = null;
  let signature: string | null = null;

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (!value) continue;
    if (key === "t") {
      timestamp = value;
    } else if (key.startsWith("v")) {
      if (!version) {
        version = key;
        signature = value;
      }
    }
  }

  if (!signature && parts.length === 1 && !parts[0].includes("=")) {
    signature = sanitize(parts[0]);
  }

  return { timestamp, version, signature };
}

function sanitize(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sanitizePayload(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "object") {
        return parsed;
      }
    } catch (_error) {
      // fall through
    }
    return { raw: value };
  }
  return value;
}

export { BASE_HEADERS as AFFILIATE_BASE_HEADERS, JSON_HEADERS as AFFILIATE_JSON_HEADERS };
export { SUPABASE_URL as AFFILIATE_SUPABASE_URL, SERVICE_ROLE_KEY as AFFILIATE_SERVICE_ROLE_KEY };
