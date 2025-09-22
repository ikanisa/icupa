import {
  ERROR_CODES,
  type ErrorCode,
  HEALTH_RESPONSE_HEADERS,
  OBS_EVENTS,
} from "./constants.ts";

type ObsHandler = (req: Request) => Promise<Response> | Response;

interface WithObsOptions {
  fn: string;
  defaultErrorCode?: ErrorCode;
}

interface LogShape {
  level: "AUDIT" | "INFO" | "WARN" | "ERROR";
  event: string;
  fn: string;
  requestId: string;
  [key: string]: unknown;
}

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

function log(shape: LogShape) {
  try {
    console.log(JSON.stringify(shape));
  } catch (_error) {
    console.log('{"level":"ERROR","event":"obs.log_failure"}');
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
