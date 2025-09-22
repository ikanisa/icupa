import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase configuration for eval runner");
}

interface EvalCase {
  agent: string;
  input: unknown;
  expected?: unknown;
  tool_call?: {
    key: string;
    input?: Record<string, unknown>;
  };
}

interface RunnerPayload {
  label?: string;
  limit?: number;
}

interface ScoreResult {
  pass: boolean;
  reason?: string;
}

const ORCHESTRATOR_URL = `${SUPABASE_URL}/functions/v1/agent-orchestrator`;
const BASELINE_PATHS = [
  "../../../agents/evals/baseline_v2.jsonl",
  "../../../agents/evals/baseline.jsonl",
  "../../agents/evals/baseline.jsonl",
];
const EMBEDDED_BASELINE_CASES: EvalCase[] = [
  {
    agent: "PlannerCoPilot",
    input: "Provide two mid-range hotel quotes for Kigali",
    tool_call: {
      key: "quote.search",
      input: {
        destination: "Kigali",
        start_date: "2025-10-01",
        end_date: "2025-10-05",
        party: { adults: 2 },
      },
    },
    expected: { planned_tool: { key: "quote.search" } },
  },
  {
    agent: "ConciergeGuide",
    input: "Send day brief for gorilla trek",
    tool_call: {
      key: "map.route",
      input: {
        origin: "Sabyinyo Silverback Lodge",
        destination: "Kigali Marriott",
        departure_time: "2025-10-02T15:00:00Z",
      },
    },
    expected: { planned_tool: { key: "map.route" } },
  },
  {
    agent: "GroupBuilder",
    input: "Review escrow G1",
    tool_call: {
      key: "groups.payouts_report",
      input: {
        from: "2025-09-01T00:00:00Z",
        to: "2025-09-30T23:59:59Z",
      },
    },
    expected: { planned_tool: { key: "groups.payouts_report" } },
  },
];
const DEFAULT_LIMIT = 9999;

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("agents-eval-runner");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST required" }, 405);
  }

  let payload: RunnerPayload = {};
  try {
    payload = (await req.json()) as RunnerPayload;
  } catch (_error) {
    payload = {};
  }

  let evalCases: EvalCase[];
  try {
    evalCases = await loadEvalCases(payload.limit ?? DEFAULT_LIMIT);
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: `Failed to load eval cases: ${(error as Error).message}`,
    }, 500);
  }
  if (evalCases.length === 0) {
    return jsonResponse({ ok: false, error: "No eval cases found" }, 500);
  }

  const label = typeof payload.label === "string" ? payload.label.trim() : null;
  let runId: string;
  try {
    const runRow = await createEvalRun(label);
    runId = String(runRow.id);
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: `Failed to create run: ${(error as Error).message}`,
    }, 500);
  }

  let total = 0;
  let passed = 0;
  let failed = 0;
  const perAgent: Map<string, { total: number; passed: number }> = new Map();
  const startRun = performance.now();

  for (const evalCase of evalCases) {
    total += 1;
    const agentKey = evalCase.agent;
    const caseStart = performance.now();
    let responseJson: Record<string, unknown> | null = null;
    let durationMs = 0;
    let score: ScoreResult = { pass: false, reason: "No response" };

    try {
      responseJson = await invokeOrchestrator(evalCase);
      durationMs = Math.round(performance.now() - caseStart);
      score = scoreCase(responseJson, evalCase.expected);
    } catch (error) {
      durationMs = Math.round(performance.now() - caseStart);
      score = { pass: false, reason: (error as Error).message };
    }

    if (score.pass) {
      passed += 1;
    } else {
      failed += 1;
    }

    const agentStats = perAgent.get(agentKey) ?? { total: 0, passed: 0 };
    agentStats.total += 1;
    if (score.pass) agentStats.passed += 1;
    perAgent.set(agentKey, agentStats);

    try {
      await insertEvalCase(
        runId,
        agentKey,
        evalCase,
        responseJson,
        score,
        durationMs,
      );
    } catch (error) {
      return jsonResponse({
        ok: false,
        error: `Failed to insert case: ${(error as Error).message}`,
      }, 500);
    }
  }

  try {
    await finalizeEvalRun(runId, total, passed, failed);
    await upsertEvalScores(perAgent);
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: `Failed to finalize run: ${(error as Error).message}`,
    }, 500);
  }

  audit({
    run_id: runId,
    label: label ?? "",
    total,
    passed,
    failed,
    request_id: requestId,
  });

  return jsonResponse({
    ok: true,
    run_id: runId,
    total,
    passed,
    failed,
    request_id: requestId,
  });
}, { fn: "agents-eval-runner", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function audit(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "agents.eval_run",
      fn: "agents-eval-runner",
      ...fields,
    }),
  );
}

async function loadEvalCases(limit: number): Promise<EvalCase[]> {
  let text = "";
  for (const candidate of BASELINE_PATHS) {
    try {
      text = await Deno.readTextFile(new URL(candidate, import.meta.url));
      break;
    } catch (_error) {
      continue;
    }
  }

  if (!text) {
    if (EMBEDDED_BASELINE_CASES.length === 0) {
      throw new Error("Unable to read agents/evals/baseline.jsonl");
    }
    return EMBEDDED_BASELINE_CASES.slice(0, limit);
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) =>
    line.length > 0
  );
  const cases: EvalCase[] = [];
  for (const line of lines) {
    if (cases.length >= limit) break;
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const agent = typeof parsed.agent === "string" ? parsed.agent : null;
      if (!agent) continue;
      const evalCase: EvalCase = {
        agent,
        input: parsed.input ?? null,
        expected: parsed.expected,
      };
      if (parsed.tool_call && typeof parsed.tool_call === "object") {
        evalCase.tool_call = parsed.tool_call as EvalCase["tool_call"];
      }
      cases.push(evalCase);
    } catch (_error) {
      continue;
    }
  }
  return cases;
}

async function invokeOrchestrator(
  evalCase: EvalCase,
): Promise<Record<string, unknown>> {
  const payload: Record<string, unknown> = {
    agent: evalCase.agent,
    goal: evalCase.input,
    dry_run: true,
  };
  if (evalCase.tool_call) {
    payload.tool_call = evalCase.tool_call;
  }

  const response = await fetch(ORCHESTRATOR_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`orchestrator error: ${text}`);
  }

  const json = await response.json();
  if (!json || typeof json !== "object") {
    throw new Error("invalid orchestrator response");
  }
  return json as Record<string, unknown>;
}

function scoreCase(
  actual: Record<string, unknown>,
  expected: unknown,
): ScoreResult {
  if (!actual.ok) {
    return { pass: false, reason: "orchestrator returned not ok" };
  }
  if (!expected) {
    return { pass: true };
  }
  const matches = deepContains(actual, expected);
  return matches
    ? { pass: true }
    : { pass: false, reason: "expected structure missing" };
}

function deepContains(actual: unknown, expected: unknown): boolean {
  if (expected === null || expected === undefined) {
    return true;
  }
  if (typeof expected !== "object") {
    return actual === expected;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    if (expected.length > actual.length) return false;
    for (let i = 0; i < expected.length; i++) {
      if (!deepContains(actual[i], expected[i])) return false;
    }
    return true;
  }

  if (typeof actual !== "object" || actual === null) return false;
  for (
    const [key, value] of Object.entries(expected as Record<string, unknown>)
  ) {
    if (!(key in (actual as Record<string, unknown>))) return false;
    if (!deepContains((actual as Record<string, unknown>)[key], value)) {
      return false;
    }
  }
  return true;
}

async function createEvalRun(label: string | null) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/agent_eval_create_run`,
    {
      method: "POST",
      headers: restHeaders(),
      body: JSON.stringify({ p_label: label }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text);
  }
  const data = await response.json();
  if (!data || typeof data !== "object") {
    throw new Error("invalid create_run response");
  }
  return data as Record<string, unknown>;
}

async function insertEvalCase(
  runId: string,
  agentKey: string,
  evalCase: EvalCase,
  responseJson: Record<string, unknown> | null,
  score: ScoreResult,
  durationMs: number,
) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/agent_eval_insert_case`,
    {
      method: "POST",
      headers: restHeaders(),
      body: JSON.stringify({
        p_run: runId,
        p_agent: agentKey,
        p_input: wrapInput(evalCase),
        p_expected: evalCase.expected ?? null,
        p_result: buildResultPayload(responseJson, score),
        p_pass: score.pass,
        p_duration: durationMs,
      }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text);
  }
}

async function finalizeEvalRun(
  runId: string,
  total: number,
  passed: number,
  failed: number,
) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/agent_eval_finalize_run`,
    {
      method: "POST",
      headers: restHeaders(),
      body: JSON.stringify({
        p_run: runId,
        p_total: total,
        p_passed: passed,
        p_failed: failed,
      }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text);
  }
}

async function upsertEvalScores(
  perAgent: Map<string, { total: number; passed: number }>,
) {
  if (perAgent.size === 0) return;
  for (const [agent, stats] of perAgent.entries()) {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/agent_eval_insert_score`,
      {
        method: "POST",
        headers: restHeaders(),
        body: JSON.stringify({
          p_agent: agent,
          p_metric: "pass_rate",
          p_value: stats.total === 0 ? 0 : stats.passed / stats.total,
          p_window: "last_run",
          p_computed: new Date().toISOString(),
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text);
    }
  }
}

function wrapInput(evalCase: EvalCase) {
  return {
    goal: evalCase.input,
    tool_call: evalCase.tool_call ?? null,
  };
}

function buildResultPayload(
  responseJson: Record<string, unknown> | null,
  score: ScoreResult,
) {
  if (!responseJson) {
    return { ok: false, reason: score.reason ?? "no response" };
  }
  const payload: Record<string, unknown> = {
    ok: responseJson.ok ?? false,
    session_id: responseJson.session_id ?? null,
    planned_tool: responseJson.planned_tool ?? null,
    tool_result: responseJson.tool_result ?? null,
  };
  if (score.reason) {
    payload.reason = score.reason;
  }
  return payload;
}

function restHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_ROLE_KEY!,
    "content-type": "application/json",
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
