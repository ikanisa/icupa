import { ERROR_CODES } from "../_obs/constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";
const PROJECT_REF = extractProjectRef(SUPABASE_URL);

const DEFAULT_PREFIX_LENGTH = Number(
  Deno.env.get("B2B_KEY_PREFIX_LENGTH") ?? "12",
);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "b2b-auth requires SUPABASE_URL and SUPABASE_SERVICE_ROLE to verify API keys.",
  );
}

export interface B2BPrincipal {
  id: string;
  name: string;
  status: "active" | "suspended" | "revoked" | string;
  scopes: string[];
  description: string | null;
  key_prefix: string;
  usage_count: number;
  last_used_at: string | null;
}

export interface RequireB2BKeyOptions {
  scopes?: string[];
  allowSuspended?: boolean;
}

export class B2BAuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: keyof typeof ERROR_CODES | "FORBIDDEN" | "NOT_FOUND",
  ) {
    super(message);
  }
}

interface ApiKeyRecord {
  id: string;
  name: string;
  status: string;
  scopes: string[];
  description: string | null;
  key_prefix: string;
  key_hash: string;
  usage_count: number | null;
  last_used_at: string | null;
}

export async function requireB2BKey(
  req: Request,
  options: RequireB2BKeyOptions = {},
): Promise<B2BPrincipal> {
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    throw new B2BAuthError("Missing Authorization bearer token", 401, "AUTH_REQUIRED");
  }

  const prefixLength = Math.max(8, DEFAULT_PREFIX_LENGTH);
  const keyPrefix = apiKey.slice(0, prefixLength);
  if (!/^[a-zA-Z0-9_-]{8,}$/.test(keyPrefix)) {
    throw new B2BAuthError("Malformed API key", 401, "AUTH_REQUIRED");
  }

  const record = await lookupApiKey(keyPrefix);
  if (!record) {
    throw new B2BAuthError("API key not recognized", 403, "NOT_FOUND");
  }

  if (record.status === "revoked") {
    throw new B2BAuthError("API key revoked", 403, "FORBIDDEN");
  }

  if (record.status === "suspended" && !options.allowSuspended) {
    throw new B2BAuthError("API key suspended", 403, "FORBIDDEN");
  }

  const providedHash = await hashKey(apiKey);
  if (!timingSafeEqual(record.key_hash, providedHash)) {
    throw new B2BAuthError("API key mismatch", 403, "FORBIDDEN");
  }

  if (options.scopes && options.scopes.length > 0) {
    const missing = options.scopes.filter((scope) => !record.scopes.includes(scope));
    if (missing.length > 0) {
      throw new B2BAuthError(
        `Missing required scope(s): ${missing.join(", ")}`,
        403,
        "FORBIDDEN",
      );
    }
  }

  await recordUsage(record.id, req, record.usage_count ?? 0).catch((error) => {
    console.warn(
      JSON.stringify({
        level: "WARN",
        event: "b2b.auth.usage_error",
        fn: "b2b-auth",
        message: (error as Error).message,
      }),
    );
  });

  return {
    id: record.id,
    name: record.name,
    status: record.status,
    scopes: record.scopes,
    description: record.description,
    key_prefix: record.key_prefix,
    usage_count: record.usage_count ?? 0,
    last_used_at: record.last_used_at,
  };
}

function extractApiKey(req: Request): string | null {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) return null;
  const parts = header.trim().split(/\s+/);
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1];
  }
  return null;
}

async function lookupApiKey(prefix: string): Promise<ApiKeyRecord | null> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/api_keys`);
  url.searchParams.set("select", "id,name,status,scopes,description,key_prefix,key_hash,usage_count,last_used_at");
  url.searchParams.set("key_prefix", `eq.${prefix}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Accept-Profile": "b2b",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to look up API key: ${response.status}`);
  }

  const payload = await response.json();
  if (Array.isArray(payload) && payload.length > 0) {
    const record = payload[0] as Partial<ApiKeyRecord>;
    if (
      record && typeof record.id === "string" && typeof record.key_hash === "string"
    ) {
      return {
        id: record.id,
        name: String(record.name ?? ""),
        status: String(record.status ?? "revoked"),
        scopes: Array.isArray(record.scopes)
          ? record.scopes.filter((value): value is string => typeof value === "string")
          : [],
        description: record.description === null || typeof record.description === "string"
          ? record.description
          : null,
        key_prefix: String(record.key_prefix ?? ""),
        key_hash: record.key_hash,
        usage_count: typeof record.usage_count === "number"
          ? record.usage_count
          : record.usage_count === null
          ? null
          : Number(record.usage_count ?? 0),
        last_used_at: typeof record.last_used_at === "string"
          ? record.last_used_at
          : null,
      };
    }
  }
  return null;
}

async function recordUsage(id: string, req: Request, priorCount: number) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/api_keys`);
  url.searchParams.set("id", `eq.${id}`);

  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const remoteAddr = forwarded.split(",")[0]?.trim() ?? "";

  const body = {
    usage_count: priorCount + 1,
    last_used_at: new Date().toISOString(),
    last_ip: remoteAddr || null,
  };

  await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Accept-Profile": "b2b",
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
}

async function hashKey(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let result = 0;
  for (let i = 0; i < aBytes.length; i += 1) {
    result |= aBytes[i] ^ bBytes[i];
  }
  return result === 0;
}

function extractProjectRef(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = /https:\/\/(.*?)\.supabase\.co/.exec(parsed.origin);
    return match ? match[1] ?? null : null;
  } catch (_error) {
    return null;
  }
}

export { PROJECT_REF };
