import { ERROR_CODES } from "./constants.ts";

interface MemoryCacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache<T> {
  #entries = new Map<string, MemoryCacheEntry<T>>();
  #maxEntries: number;

  constructor(options: { maxEntries?: number } = {}) {
    this.#maxEntries = options.maxEntries ?? 200;
  }

  get(key: string): T | null {
    const entry = this.#entries.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.#entries.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    const expiresAt = Date.now() + ttlMs;
    if (this.#entries.size >= this.#maxEntries) {
      const oldest = this.#entries.keys().next();
      if (!oldest.done) {
        this.#entries.delete(oldest.value);
      }
    }
    this.#entries.set(key, { value, expiresAt });
  }

  purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.#entries.entries()) {
      if (entry.expiresAt <= now) {
        this.#entries.delete(key);
      }
    }
  }
}

export function requireIsoDate(value: string, field: string): string {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || Number.isNaN(new Date(value).getTime())) {
    const error = new Error(`${field} must be YYYY-MM-DD`);
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }
  return value;
}

export function assertPositiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    const error = new Error(`${field} must be > 0`);
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }
  return value;
}

export function assertNonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    const error = new Error(`${field} must be >= 0`);
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }
  return value;
}

export function normalizeIata(value: string, field: string): string {
  const trimmed = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(trimmed)) {
    const error = new Error(`${field} must be a 3-letter IATA code`);
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }
  return trimmed;
}

export function normalizeCurrency(value: string | undefined, fallback = "USD"): string {
  const currency = (value ?? fallback).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    const error = new Error("currency must be ISO-4217 code");
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }
  return currency;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function logAudit(event: string, payload: Record<string, unknown>): void {
  console.log(JSON.stringify({
    level: "INFO",
    event,
    ...payload,
  }));
}
