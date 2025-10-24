export type AgentEventLevel = "AUDIT" | "INFO" | "WARN" | "ERROR";

interface EmitAgentEventOptions {
  sessionId?: string | null;
  event: string;
  level?: AgentEventLevel;
  payload?: Record<string, unknown>;
}

export async function emitAgentEvent({
  sessionId,
  event,
  level = "INFO",
  payload,
}: EmitAgentEventOptions): Promise<void> {
  if (!sessionId) return;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/agent_insert_event`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
        Prefer: "params=single-object",
      },
      body: JSON.stringify({
        p_session: sessionId,
        p_level: level,
        p_event: event,
        p_payload: payload ?? {},
      }),
    });

    if (!response.ok) {
      // Best-effort telemetry; surface to console for local debugging.
      const text = await response.text();
      console.warn("emitAgentEvent failed", { status: response.status, text });
    }
  } catch (error) {
    console.warn("emitAgentEvent error", error);
  }
}
