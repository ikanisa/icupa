import { z } from "zod";

import type { FunctionDescriptor, RequestOptions } from "../types";

export async function safeJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to parse JSON response", { error, text });
    return { ok: false, raw: text } satisfies Record<string, unknown>;
  }
}

export function buildQueryString(input: unknown): string {
  if (!input || typeof input !== "object") {
    return "";
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, serializeQueryValue(entry));
      }
      continue;
    }

    params.append(key, serializeQueryValue(value));
  }

  return params.toString();
}

function serializeQueryValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return JSON.stringify(value);
}

export async function buildHeaders(
  descriptor: FunctionDescriptor<z.ZodTypeAny | undefined, z.ZodTypeAny | undefined>,
  options: {
    anonKey: string;
    getAccessToken?: () => Promise<string | null>;
    idempotencyKey?: string;
  },
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    apikey: options.anonKey,
  };

  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  if (descriptor.auth === "anon") {
    headers.Authorization = `Bearer ${options.anonKey}`;
    return headers;
  }

  if (descriptor.auth === "user") {
    const token = (await options.getAccessToken?.()) ?? options.anonKey;
    headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  throw new Error("Service role access is not available from the client SDK.");
}

export function resolveSignal(
  requestOptions: RequestOptions,
  controller: AbortController,
): AbortSignal {
  return requestOptions.signal ?? controller.signal;
}
