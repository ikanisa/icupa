const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase configuration for agent events report");
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return jsonResponse({ ok: false, error: "GET required" }, 405);
  }

  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const sessionId = url.searchParams.get("session_id");
  const level = url.searchParams.get("level");

  const filters: string[] = [];
  if (sessionId) {
    if (!UUID_REGEX.test(sessionId)) {
      return jsonResponse({ ok: false, error: "session_id must be a UUID" }, 400);
    }
    filters.push(`session_id=eq.${sessionId}`);
  }

  if (level) {
    const allowedLevels = new Set(["AUDIT", "INFO", "WARN", "ERROR"]);
    if (!allowedLevels.has(level)) {
      return jsonResponse({ ok: false, error: "level must be AUDIT|INFO|WARN|ERROR" }, 400);
    }
    filters.push(`level=eq.${level}`);
  }

  const queryParams = new URLSearchParams();
  queryParams.set("order", "created_at.desc");
  queryParams.set("limit", String(limit));
  for (const filter of filters) {
    const [column, value] = filter.split("=");
    queryParams.append(column, value);
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/agent_events_view?${queryParams.toString()}`, {
      headers: serviceHeaders()
    });

    if (!response.ok) {
      const text = await response.text();
      return jsonResponse({ ok: false, error: `fetch failed: ${text}` }, 502);
    }

    const events = await response.json();
    return jsonResponse({ ok: true, events });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) }, 500);
  }
});

function parseLimit(raw: string | null): number {
  const fallback = 50;
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.min(200, Math.floor(value));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function serviceHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`
  };
}
