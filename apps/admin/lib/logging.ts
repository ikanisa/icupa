import { createAdminServerClient } from "./supabaseServer";

const scope = "ops.console" as const;

export function logAdminAction(event: string, fields: Record<string, unknown>) {
  const entry = {
    level: "info",
    scope,
    event,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  console.log(JSON.stringify(entry));
}

type AuditPayload = Record<string, unknown>;

type AuditResult =
  | { ok: true }
  | { ok: false; reason: "no_client" | "insert_failed"; error?: string };

export async function recordAuditEvent(what: string, payload: AuditPayload): Promise<AuditResult> {
  const supabase = await createAdminServerClient();
  if (!supabase) {
    console.warn(JSON.stringify({ scope, level: "warn", event: "audit.insert.skipped", what, reason: "no_client" }));
    return { ok: false, reason: "no_client" };
  }

  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error(JSON.stringify({ scope, level: "error", event: "audit.session.error", what, message: sessionError.message }));
  }

  const { error } = await supabase.from("audit.events").insert({
    who: data?.session?.user?.id ?? null,
    what,
    payload,
  });

  if (error) {
    console.error(JSON.stringify({ scope, level: "error", event: "audit.insert.failed", what, message: error.message }));
    return { ok: false, reason: "insert_failed", error: error.message };
  }

  return { ok: true };
}
