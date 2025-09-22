import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase configuration for eval report");
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const handler = withObs(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("agents-eval-report");
  }

  if (req.method !== "GET") {
    return jsonResponse({ ok: false, error: "GET required" }, 405);
  }

  const runId = url.searchParams.get("run_id");
  if (!runId || !UUID_REGEX.test(runId)) {
    return jsonResponse({ ok: false, error: "run_id must be a UUID" }, 400);
  }

  try {
    const run = await fetchRun(runId);
    if (!run) {
      return jsonResponse({ ok: false, error: "run not found" }, 404);
    }

    const cases = await fetchCases(runId);
    const perAgent = buildAgentSummary(cases);
    const topFailures = buildTopFailures(cases, 5);
    const scores = await fetchScores(perAgent.keys());

    return jsonResponse({
      ok: true,
      run,
      per_agent: Array.from(perAgent.values()),
      top_failures: topFailures,
      scores,
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) }, 500);
  }
}, { fn: "agents-eval-report", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

async function fetchRun(runId: string) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/agent_eval_runs_view?id=eq.${runId}&select=*`,
    {
      headers: jsonHeaders(),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`fetch run failed: ${text}`);
  }
  const data = await response.json();
  if (Array.isArray(data) && data[0]) {
    return data[0];
  }
  return null;
}

async function fetchCases(runId: string) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/agent_eval_cases_view?run_id=eq.${runId}&select=*`,
    {
      headers: jsonHeaders(),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`fetch cases failed: ${text}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

function buildAgentSummary(cases: any[]) {
  const map = new Map<
    string,
    { agent_key: string; total: number; passed: number; pass_rate: number }
  >();
  for (const item of cases) {
    const agentKey = String(item.agent_key ?? "unknown");
    const stat = map.get(agentKey) ??
      { agent_key: agentKey, total: 0, passed: 0, pass_rate: 0 };
    stat.total += 1;
    if (item.pass) stat.passed += 1;
    map.set(agentKey, stat);
  }
  for (const entry of map.values()) {
    entry.pass_rate = entry.total === 0 ? 0 : entry.passed / entry.total;
  }
  return map;
}

function buildTopFailures(cases: any[], limit: number) {
  const failures = cases
    .filter((item) => !item.pass)
    .map((item) => ({
      agent_key: item.agent_key,
      input: item.input,
      expected: item.expected,
      result: item.result,
      duration_ms: item.duration_ms,
      created_at: item.created_at,
    }))
    .slice(0, limit);
  return failures;
}

async function fetchScores(agentKeys: Iterable<string>) {
  const keys = Array.from(agentKeys);
  if (keys.length === 0) return [];
  const params = new URLSearchParams();
  params.set("select", "agent_key,metric,value,window_label,computed_at");
  params.set("window_label", "eq.last_run");
  params.set("agent_key", `in.(${keys.map((k) => `"${k}"`).join(",")})`);

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/agent_eval_scores_view?${params.toString()}`,
    {
      headers: jsonHeaders(),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`fetch scores failed: ${text}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

function jsonHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_ROLE_KEY!,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
