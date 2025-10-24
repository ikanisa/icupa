const TRUE_VALUES = new Set(["1", "true", "TRUE"]);

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};


const OFFLINE_MARKERS: { key: string; value: string | undefined }[] = [
  { key: "CI_OFFLINE", value: process.env.CI_OFFLINE },
  { key: "OPSCONSOLE_BYPASS_AUTH", value: process.env.OPSCONSOLE_BYPASS_AUTH },
  { key: "OPSCONSOLE_OFFLINE_MODE", value: process.env.OPSCONSOLE_OFFLINE_MODE },
  { key: "OPS_CONSOLE_BYPASS_AUTH", value: process.env.OPS_CONSOLE_BYPASS_AUTH },
];

export type OpsDataMode =
  | { mode: "live" }
  | { mode: "fixtures"; toggles: string[] }
  | { mode: "blocked"; toggles: string[]; reason: string };

function activeOfflineToggles(): string[] {
  return OFFLINE_MARKERS.filter((entry) => entry.value && TRUE_VALUES.has(entry.value)).map((entry) => entry.key);
}

export function determineOpsDataMode(): OpsDataMode {
  const toggles = activeOfflineToggles();
  if (toggles.length === 0) {
    return { mode: "live" };
  }

  const environment = ((process.env.NODE_ENV ?? process.env.ENVIRONMENT ?? process.env.STAGE ?? "development")).toLowerCase();
  if (environment === "production") {
    return {
      mode: "blocked",
      toggles,
      reason: "Offline fixture toggles were detected in a production environment.",
    };
  }

  return { mode: "fixtures", toggles };
}

export function listOfflineToggles(): string[] {
  return activeOfflineToggles();
}

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

  const safeUrl = url!;
  const safeAnonKey = anonKey!;
  return { ok: true, config: { url: safeUrl, anonKey: safeAnonKey } };
}

export function opsConsoleOfflineModeEnabled(): boolean {
  return activeOfflineToggles().length > 0;
}
