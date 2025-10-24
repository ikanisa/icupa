import { ERROR_CODES } from "./constants.ts";
import { getSupabaseServiceConfig } from "./env.ts";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "inventory" });

const CATALOG_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Accept-Profile": "catalog",
};

const CACHE_TABLE_URL = `${SUPABASE_URL}/rest/v1/catalog.search_cache`;

export interface CacheEntry {
  cache_key: string;
  params_hash: string;
  response: Record<string, unknown>;
  etag?: string | null;
  expires_at: string;
  created_at: string;
}

export async function getCachedResponse(
  cacheKey: string,
): Promise<CacheEntry | null> {
  const url = `${CACHE_TABLE_URL}?cache_key=eq.${
    encodeURIComponent(cacheKey)
  }&limit=1`;
  const response = await fetch(url, {
    headers: CATALOG_HEADERS,
  });
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`cache fetch failed: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }
  const json = await response.json();
  if (!Array.isArray(json) || !json[0]) return null;
  return json[0] as CacheEntry;
}

export async function upsertCache(entry: {
  cache_key: string;
  params_hash: string;
  response: Record<string, unknown>;
  etag?: string | null;
  expires_at: string;
}): Promise<void> {
  const body = [{
    cache_key: entry.cache_key,
    params_hash: entry.params_hash,
    response: entry.response,
    etag: entry.etag ?? null,
    expires_at: entry.expires_at,
  }];
  const response = await fetch(CACHE_TABLE_URL, {
    method: "POST",
    headers: {
      ...CATALOG_HEADERS,
      "Content-Type": "application/json",
      "Content-Profile": "catalog",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`cache upsert failed: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }
}

export async function stableHash(input: unknown): Promise<string> {
  const json = stableStringify(input);
  const encoder = new TextEncoder();
  const data = encoder.encode(json);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  entries.sort(([a], [b]) => a.localeCompare(b));
  const props = entries.map(([key, val]) =>
    `${JSON.stringify(key)}:${stableStringify(val)}`
  );
  return `{${props.join(",")}}`;
}

export interface RateLimiterOptions {
  capacity: number;
  refillIntervalMs: number;
}

export class TokenBucket {
  #capacity: number;
  #tokens: number;
  #refillIntervalMs: number;
  #lastRefill: number;

  constructor(options: RateLimiterOptions) {
    this.#capacity = options.capacity;
    this.#tokens = options.capacity;
    this.#refillIntervalMs = options.refillIntervalMs;
    this.#lastRefill = Date.now();
  }

  consume(tokens = 1) {
    this.#refill();
    if (this.#tokens < tokens) {
      const error = new Error("rate limit exceeded");
      (error as { code?: string }).code = ERROR_CODES.RATE_LIMITED;
      throw error;
    }
    this.#tokens -= tokens;
  }

  #refill() {
    const now = Date.now();
    const elapsed = now - this.#lastRefill;
    if (elapsed <= 0) return;
    const refill = Math.floor(elapsed / this.#refillIntervalMs);
    if (refill > 0) {
      this.#tokens = Math.min(this.#capacity, this.#tokens + refill);
      this.#lastRefill = now;
    }
  }
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  coolDownMs: number;
}

export class CircuitBreaker {
  #failureThreshold: number;
  #coolDownMs: number;
  #failureCount = 0;
  #state: "closed" | "open" | "half-open" = "closed";
  #nextAttempt = 0;

  constructor(options: CircuitBreakerOptions) {
    this.#failureThreshold = options.failureThreshold;
    this.#coolDownMs = options.coolDownMs;
  }

  canRequest(): boolean {
    const now = Date.now();
    if (this.#state === "open") {
      if (now >= this.#nextAttempt) {
        this.#state = "half-open";
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess() {
    this.#failureCount = 0;
    this.#state = "closed";
  }

  recordFailure() {
    this.#failureCount += 1;
    if (this.#failureCount >= this.#failureThreshold) {
      this.#state = "open";
      this.#nextAttempt = Date.now() + this.#coolDownMs;
    }
  }

  state(): string {
    return this.#state;
  }
}

export interface RetryBackoffOptions {
  attempts?: number;
  baseDelayMs?: number;
  onRetry?: (info: { attempt: number; waitMs: number; error: Error }) => void;
}

export async function retryWithBackoff<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryBackoffOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 250;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      const wrapped = error instanceof Error ? error : new Error(String(error));
      const retryable = (wrapped as { retryable?: boolean }).retryable === true;
      if (attempt >= attempts || !retryable) {
        throw wrapped;
      }
      const waitMs = baseDelayMs * 2 ** (attempt - 1);
      options.onRetry?.({ attempt, waitMs, error: wrapped });
      await delay(waitMs);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("retryWithBackoff failed");
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
