const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Supabase configuration missing for agent-log-goal");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST required" }, 405);
  }

  if (!authorize(req)) {
    return jsonResponse({ ok: false, error: "forbidden" }, 403);
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid json" }, 400);
  }

  const goal = typeof payload.goal === "string" ? payload.goal.trim() : "";
  const userWa = typeof payload.user_wa === "string" ? payload.user_wa.trim() : "";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const requestId = typeof payload.request_id === "string" && payload.request_id
    ? payload.request_id
    : crypto.randomUUID();

  console.log(
    `AUDIT agent.log_goal requestId=${requestId} userWa=${userWa} goal=${goal ? goal.slice(0, 60) : ""}`
  );

  return jsonResponse({
    ok: true,
    logged: Boolean(goal || message),
    goal,
    user_wa: userWa,
    request_id: requestId
  });
});

function authorize(req: Request): boolean {
  const apiKeyHeader = req.headers.get("apikey") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  if (!SERVICE_ROLE_KEY) return false;
  const bearer = `Bearer ${SERVICE_ROLE_KEY}`;
  return apiKeyHeader === SERVICE_ROLE_KEY && authHeader === bearer;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}
