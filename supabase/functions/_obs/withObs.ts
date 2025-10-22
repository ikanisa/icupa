import {
  ERROR_CODES,
  type ErrorCode,
  HEALTH_RESPONSE_HEADERS,
  OBS_EVENTS,
} from "./constants.ts";

const OBS_FORWARD_WEBHOOK_URL = Deno.env.get("OBS_FORWARD_WEBHOOK_URL") ?? "";
const ANALYTICS_FORWARD_WEBHOOK_URL =
  Deno.env.get("OBS_ANALYTICS_WEBHOOK_URL") ?? "";

const ROOT_CONSOLE = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

type ObsHandler = (req: Request) => Promise<Response> | Response;

interface WithObsOptions {
  fn: string;
  defaultErrorCode?: ErrorCode;
}

interface MetricDatum {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
}

interface LogShape extends Record<string, unknown> {
  level: "AUDIT" | "INFO" | "WARN" | "ERROR";
  event: string;
  fn: string;
  requestId: string;
  ts?: string;
  metric?: MetricDatum;
  tags?: Record<string, string>;
}

type PartialLog = Record<string, unknown> & {
  level?: unknown;
  event?: unknown;
  fn?: unknown;
  requestId?: unknown;
  ts?: unknown;
  metric?: unknown;
  tags?: unknown;
};

const TEXT_RESPONSE_HEADERS = {
  "content-type": "application/json",
} as const;

const OBS_REQUEST_ID_FIELD = "__obsRequestId";

export function withObs(handler: ObsHandler, opts: WithObsOptions): ObsHandler {
  const fnName = opts.fn;
  const defaultErrorCode = opts.defaultErrorCode ?? ERROR_CODES.UNKNOWN;

  return async (req: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const start = performance.now();
    const restoreConsole = patchConsole(fnName, requestId);
    try {
      try {
        (req as unknown as Record<string, unknown>)[OBS_REQUEST_ID_FIELD] =
          requestId;
      } catch (_err) {
        // ignore – best effort only
      }

      log({
        level: "AUDIT",
        event: OBS_EVENTS.HTTP_REQUEST,
        fn: fnName,
        requestId,
        method: req.method,
        url: req.url,
      });

      try {
        const response = await handler(req);
        const ms = Math.round(performance.now() - start);
        try {
          response.headers.set("x-request-id", requestId);
        } catch (_err) {
          // If headers are immutable (e.g., Response.redirect), clone minimal response.
          return cloneWithRequestId(response, requestId, ms, fnName);
        }

        log({
          level: "INFO",
          event: OBS_EVENTS.HTTP_RESPONSE,
          fn: fnName,
          requestId,
          status: response.status,
          ms,
          ok: response.ok,
        });

        return response;
      } catch (error) {
        const ms = Math.round(performance.now() - start);
        const { code, message } = normalizeError(error, defaultErrorCode);

        log({
          level: "ERROR",
          event: OBS_EVENTS.HTTP_ERROR,
          fn: fnName,
          requestId,
          code,
          message,
          ms,
        });

        return new Response(
          JSON.stringify({ ok: false, error: "internal_error", requestId }),
          {
            status: 500,
            headers: {
              ...TEXT_RESPONSE_HEADERS,
              "x-request-id": requestId,
            },
          },
        );
      }
    } finally {
      restoreConsole();
    }
  };
}

export function healthResponse(fn: string): Response {
  const body = {
    ok: true,
    fn,
    time: new Date().toISOString(),
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: HEALTH_RESPONSE_HEADERS,
  });
}

export function getRequestId(req: Request): string | undefined {
  const id = (req as unknown as Record<string, unknown>)[OBS_REQUEST_ID_FIELD];
  return typeof id === "string" ? id : undefined;
}

export function emitMetric(
  details: {
    fn: string;
    requestId: string;
    name: string;
    value: number;
    unit?: string;
    tags?: Record<string, string>;
    event?: string;
    level?: LogShape["level"];
  },
) {
  log({
    level: details.level ?? "INFO",
    event: details.event ?? "metric.datapoint",
    fn: details.fn,
    requestId: details.requestId,
    metric: {
      name: details.name,
      value: details.value,
      unit: details.unit,
      tags: details.tags,
    },
  });
}

function log(shape: PartialLog) {
  const normalized = normalizeLogFields(shape, {
    level: normalizeLevel(shape.level, "INFO"),
    event:
      typeof shape.event === "string" && shape.event.length > 0
        ? (shape.event as string)
        : "obs.event",
    fn:
      typeof shape.fn === "string" && shape.fn.length > 0
        ? (shape.fn as string)
        : "unknown",
    requestId:
      typeof shape.requestId === "string" && shape.requestId.length > 0
        ? (shape.requestId as string)
        : crypto.randomUUID(),
  });
  emitStructuredLog(normalized);
}

async function forwardLog(shape: LogShape) {
  const enriched = shape.ts
    ? shape
    : { ...shape, ts: new Date().toISOString() };
  const targets = [
    { url: OBS_FORWARD_WEBHOOK_URL, failureEvent: "obs.forward_failure" },
    {
      url: ANALYTICS_FORWARD_WEBHOOK_URL,
      failureEvent: "analytics.forward_failure",
    },
  ].filter((item) => item.url);
  if (targets.length === 0) return;

  const payload = JSON.stringify({
    ...enriched,
    forwardedAt: new Date().toISOString(),
  });

  await Promise.all(
    targets.map(async ({ url, failureEvent }) => {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        });
        if (!response.ok) {
          ROOT_CONSOLE.log(
            JSON.stringify({
              level: "WARN",
              event: failureEvent,
              status: response.status,
              fn: enriched.fn,
              requestId: enriched.requestId,
            }),
          );
        }
      } catch (error) {
        ROOT_CONSOLE.log(
          JSON.stringify({
            level: "WARN",
            event: `${failureEvent}.error`,
            fn: enriched.fn,
            requestId: enriched.requestId,
            message: safeMessage(error),
          }),
        );
      }
    }),
  );
}

function emitStructuredLog(shape: LogShape) {
  const enriched = shape.ts
    ? shape
    : { ...shape, ts: new Date().toISOString() };
  try {
    ROOT_CONSOLE.log(JSON.stringify(enriched));
  } catch (_error) {
    ROOT_CONSOLE.log(
      JSON.stringify({
        level: "ERROR",
        event: "obs.log_failure",
        fn: enriched.fn,
        requestId: enriched.requestId,
      }),
    );
  }

  if (OBS_FORWARD_WEBHOOK_URL || ANALYTICS_FORWARD_WEBHOOK_URL) {
    queueMicrotask(() => {
      void forwardLog(enriched);
    });
  }
}

function normalizeLogFields(
  partial: PartialLog,
  defaults: {
    level: LogShape["level"];
    event: string;
    fn: string;
    requestId: string;
  },
): LogShape {
  const metric = sanitizeMetric(partial.metric);
  const tags = sanitizeTags(partial.tags);
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(partial)) {
    if (
      key === "level" ||
      key === "event" ||
      key === "fn" ||
      key === "requestId" ||
      key === "ts" ||
      key === "metric" ||
      key === "tags"
    ) {
      continue;
    }
    extras[key] = value;
  }

  const level = normalizeLevel(partial.level, defaults.level);
  const event =
    typeof partial.event === "string" && partial.event.length > 0
      ? (partial.event as string)
      : defaults.event;
  const fn =
    typeof partial.fn === "string" && partial.fn.length > 0
      ? (partial.fn as string)
      : defaults.fn;
  const requestId =
    typeof partial.requestId === "string" && partial.requestId.length > 0
      ? (partial.requestId as string)
      : defaults.requestId;
  const ts =
    typeof partial.ts === "string" && partial.ts.length > 0
      ? (partial.ts as string)
      : new Date().toISOString();

  const normalized: LogShape = {
    ...extras,
    level,
    event,
    fn,
    requestId,
    ts,
  };

  if (metric) {
    normalized.metric = metric;
  }

  if (tags) {
    normalized.tags = tags;
  }

  return normalized;
}

function normalizeLevel(
  value: unknown,
  fallback: LogShape["level"],
): LogShape["level"] {
  if (typeof value === "string") {
    const upper = value.toUpperCase();
    if (upper === "AUDIT" || upper === "INFO" || upper === "WARN" || upper === "ERROR") {
      return upper as LogShape["level"];
    }
  }
  return fallback;
}

function sanitizeMetric(value: unknown): MetricDatum | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const name = record.name;
  const metricValue = record.value;
  if (typeof name !== "string" || typeof metricValue !== "number") {
    return undefined;
  }
  const metric: MetricDatum = { name, value: metricValue };
  if (typeof record.unit === "string" && record.unit.length > 0) {
    metric.unit = record.unit;
  }
  if (record.tags && typeof record.tags === "object" && !Array.isArray(record.tags)) {
    const cleaned = sanitizeTags(record.tags);
    if (cleaned) {
      metric.tags = cleaned;
    }
  }
  return metric;
}

function sanitizeTags(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const entries: Record<string, string> = {};
  for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entryValue === "string") {
      entries[key] = entryValue;
    }
  }
  return Object.keys(entries).length > 0 ? entries : undefined;
}

function patchConsole(fn: string, requestId: string): () => void {
  const original = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  const factory = (level: LogShape["level"]) =>
    (...args: unknown[]) => {
      const partial = extractPartialLog(args);
      if (partial.level === undefined) {
        partial.level = level;
      }
      if (partial.fn === undefined) {
        partial.fn = fn;
      }
      if (partial.requestId === undefined) {
        partial.requestId = requestId;
      }
      if (partial.event === undefined) {
        partial.event = "log.message";
      }
      const normalized = normalizeLogFields(partial, {
        level,
        event: "log.message",
        fn,
        requestId,
      });
      emitStructuredLog(normalized);
    };

  console.log = factory("INFO");
  console.info = factory("INFO");
  console.warn = factory("WARN");
  console.error = factory("ERROR");

  return () => {
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
  };
}

function extractPartialLog(args: unknown[]): PartialLog {
  if (args.length === 0) {
    return {};
  }

  if (args.length === 1) {
    const value = args[0];
    if (typeof value === "string") {
      const parsed = tryParseJson(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { ...(parsed as Record<string, unknown>) };
      }
      return { message: value };
    }
    if (typeof value === "object" && value !== null) {
      return { ...(value as Record<string, unknown>) };
    }
    return { message: String(value) };
  }

  return { message: args.map(stringifyArg).join(" ") };
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return undefined;
  }
}

function stringifyArg(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }
  if (value === undefined) {
    return "undefined";
  }
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return "[unserializable]";
  }
}

function normalizeError(
  error: unknown,
  fallback: ErrorCode,
): { code: ErrorCode; message: string } {
  if (error && typeof error === "object") {
    const candidateCode = (error as { code?: unknown }).code;
    if (typeof candidateCode === "string" && candidateCode in ERROR_CODES) {
      return { code: candidateCode as ErrorCode, message: safeMessage(error) };
    }
  }
  return { code: fallback, message: safeMessage(error) };
}

function safeMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") {
    return truncate(error, 300);
  }
  if (error instanceof Error) {
    return truncate(error.message ?? error.name, 300);
  }
  try {
    return truncate(JSON.stringify(error), 300);
  } catch (_err) {
    return "unknown_error";
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function cloneWithRequestId(
  response: Response,
  requestId: string,
  ms: number,
  fn: string,
): Response {
  const cloned = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
  try {
    cloned.headers.set("x-request-id", requestId);
  } catch (_err) {
    // give up silently
  }

  log({
    level: "WARN",
    event: "http.response.clone",
    fn,
    requestId,
    ms,
    status: response.status,
    ok: response.ok,
  });

  return cloned;
}
