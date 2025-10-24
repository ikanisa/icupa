export interface AgentToolSpanTelemetryOptions {
  agentKey: string;
  toolKey: string;
  requestId?: string;
  startMs: number;
  durationMs: number;
  ok: boolean;
  status?: number;
  requestPayload?: unknown;
  responsePayload?: unknown;
  error?: unknown;
}

export type AgentToolSpanTelemetryPayload = Record<string, unknown>;

const encoder = new TextEncoder();

export async function buildAgentToolSpanPayload(
  options: AgentToolSpanTelemetryOptions,
): Promise<AgentToolSpanTelemetryPayload> {
  const startMs = Number.isFinite(options.startMs)
    ? Math.trunc(options.startMs)
    : Date.now();
  const durationMsRaw = Number.isFinite(options.durationMs)
    ? options.durationMs
    : 0;
  const durationMs = Math.max(0, Math.trunc(durationMsRaw));

  const payload: AgentToolSpanTelemetryPayload = {
    agent: options.agentKey,
    tool_key: options.toolKey,
    start_ms: startMs,
    duration_ms: durationMs,
    ok: options.ok,
  };

  if (options.requestId) {
    payload.request_id = options.requestId;
  }

  if (typeof options.status === "number") {
    payload.status = options.status;
  }

  const hashes: Record<string, string> = {};
  const tokenCounts: Record<string, number> = {};
  const byteCounts: Record<string, number> = {};

  const requestSnapshot = snapshotContent(options.requestPayload);
  if (requestSnapshot) {
    hashes.request = await sha256Hex(requestSnapshot.text);
    tokenCounts.request = requestSnapshot.tokens;
    byteCounts.request = requestSnapshot.bytes;
  }

  const responseSnapshot = snapshotContent(options.responsePayload);
  if (responseSnapshot) {
    hashes.response = await sha256Hex(responseSnapshot.text);
    tokenCounts.response = responseSnapshot.tokens;
    byteCounts.response = responseSnapshot.bytes;
  }

  const errorSnapshot = snapshotContent(normalizeError(options.error));
  if (errorSnapshot) {
    hashes.error = await sha256Hex(errorSnapshot.text);
    tokenCounts.error = errorSnapshot.tokens;
    byteCounts.error = errorSnapshot.bytes;
  }

  if (Object.keys(hashes).length > 0) {
    payload.hashes = hashes;
  }

  if (Object.keys(tokenCounts).length > 0) {
    payload.token_counts = tokenCounts;
  }

  if (Object.keys(byteCounts).length > 0) {
    payload.byte_counts = byteCounts;
  }

  payload.privacy = {
    raw_content: false,
    hashing: "sha256",
  };

  return payload;
}

function snapshotContent(value: unknown):
  | { text: string; tokens: number; bytes: number }
  | null {
  if (value === undefined || value === null) {
    return null;
  }

  let text: string;
  if (typeof value === "string") {
    text = value;
  } else if (value instanceof Uint8Array) {
    text = new TextDecoder().decode(value);
  } else {
    try {
      text = JSON.stringify(value);
    } catch (_error) {
      text = String(value);
    }
  }

  if (!text) {
    return null;
  }

  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  const bytes = encoder.encode(normalized).length;
  const tokens = estimateTokenCount(normalized);

  return { text: normalized, tokens, bytes };
}

function normalizeError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch (_error) {
    return String(error);
  }
}

async function sha256Hex(value: string): Promise<string> {
  const data = encoder.encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function estimateTokenCount(value: string): number {
  if (!value) return 0;
  const matches = value.match(/\w+|[^\s]/g);
  return matches ? matches.length : 0;
}
