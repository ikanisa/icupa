const TRUE_VALUES = new Set(["1", "true", "TRUE"]);

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

type ConfigResult =
  | { ok: true; config: SupabaseConfig }
  | { ok: false; missing: string[] };

export function readSupabaseConfig(): ConfigResult {
  const missing: string[] = [];
  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();

  if (!url) missing.push("SUPABASE_URL");
  if (!anonKey) missing.push("SUPABASE_ANON_KEY");

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return { ok: true, config: { url, anonKey } };
}

export function opsConsoleOfflineModeEnabled(): boolean {
  const markers = [
    process.env.CI_OFFLINE,
    process.env.OPSCONSOLE_BYPASS_AUTH,
    process.env.OPSCONSOLE_OFFLINE_MODE,
    process.env.OPS_CONSOLE_BYPASS_AUTH,
  ];
  return markers.some((value) => value && TRUE_VALUES.has(value));
}
