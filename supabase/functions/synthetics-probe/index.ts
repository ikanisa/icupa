import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { ERROR_CODES, OBS_EVENTS } from "../_obs/constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Supabase configuration missing for synthetics-probe");
}

const TARGET_FUNCTIONS = [
  "bff-quote",
  "bff-checkout",
  "wa-send",
  "agent-orchestrator",
] as const;

interface ProbeResult {
  fn: string;
  status: number;
  ms: number;
  ok: boolean;
  error?: string;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("synthetics-probe");
  }

  if (req.method !== "GET") {
    return jsonResponse({ ok: false, error: "GET only" }, 405);
  }

  const results: ProbeResult[] = [];
  for (const fn of TARGET_FUNCTIONS) {
    const start = performance.now();
    const targetUrl = `${SUPABASE_URL}/functions/v1/${fn}/health`;
    let status = 0;
    let ok = false;
    let error: string | undefined;
    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      });
      status = response.status;
      ok = response.ok;
      if (!response.ok) {
        error = await safeText(response) ?? response.statusText;
      }
    } catch (err) {
      status = 0;
      ok = false;
      error = err instanceof Error ? err.message : String(err);
    }
    const ms = Math.round(performance.now() - start);
    results.push({ fn, status, ms, ok, error });
  }

  const okCount = results.filter((item) => item.ok).length;
  const failCount = results.length - okCount;

  logSummary({ requestId, okCount, failCount });

  const body = {
    ok: failCount === 0,
    ts: new Date().toISOString(),
    request_id: requestId,
    ok_count: okCount,
    fail_count: failCount,
    results,
  };

  const status = failCount === 0 ? 200 : 503;
  return jsonResponse(body, status);
}, { fn: "synthetics-probe", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

async function safeText(response: Response): Promise<string | undefined> {
  try {
    return await response.text();
  } catch (_err) {
    return undefined;
  }
}

function logSummary(
  details: { requestId: string; okCount: number; failCount: number },
) {
  console.log(
    JSON.stringify({
      level: "INFO",
      event: OBS_EVENTS.SYNTHETICS_SUMMARY,
      fn: "synthetics-probe",
      requestId: details.requestId,
      ok_count: details.okCount,
      fail_count: details.failCount,
    }),
  );
}
