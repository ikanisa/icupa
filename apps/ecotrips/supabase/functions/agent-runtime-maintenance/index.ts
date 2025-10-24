const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase configuration for agent runtime maintenance");
}

interface CleanupRequest {
  session_days?: number;
  event_days?: number;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST required" }, 405);
  }

  let payload: CleanupRequest = {};
  try {
    if (req.headers.get("content-length") && Number(req.headers.get("content-length")) > 0) {
      payload = (await req.json()) as CleanupRequest;
    }
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const sessionDays = parseDays(payload.session_days, 30, "session_days");
  const eventDays = parseDays(payload.event_days, 30, "event_days");
  if (typeof sessionDays === "string") {
    return jsonResponse({ ok: false, error: sessionDays }, 400);
  }
  if (typeof eventDays === "string") {
    return jsonResponse({ ok: false, error: eventDays }, 400);
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/agent_cleanup`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
        Prefer: "params=single-object"
      },
      body: JSON.stringify({
        p_session_days: sessionDays,
        p_event_days: eventDays
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return jsonResponse({ ok: false, error: `cleanup failed: ${text}` }, 502);
    }

    const result = await response.json();
    return jsonResponse({ ok: true, result });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) }, 500);
  }
});

function parseDays(value: number | undefined, fallback: number, label: string): number | string {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (!Number.isFinite(value) || value < 0) {
    return `${label} must be a non-negative number`;
  }
  return Math.min(365, Math.floor(value));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}
