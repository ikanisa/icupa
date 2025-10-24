export type SupabaseConfig = {
  supabaseUrl: string;
  supabaseKey: string;
};

export type SupabaseConfigInput = Partial<SupabaseConfig>;

function readEnv(key: string): string | null {
  const value = process.env[key];
  return value && value.length > 0 ? value : null;
}

export function resolveSupabaseConfig(overrides: SupabaseConfigInput = {}): SupabaseConfig | null {
  const supabaseUrl =
    overrides.supabaseUrl ??
    readEnv("NEXT_PUBLIC_SUPABASE_URL") ??
    readEnv("SUPABASE_URL") ??
    null;

  const supabaseKey =
    overrides.supabaseKey ??
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
    readEnv("SUPABASE_ANON_KEY") ??
    null;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return { supabaseUrl, supabaseKey };
}

export function getSupabaseConfig(overrides: SupabaseConfigInput = {}): SupabaseConfig {
  const resolved = resolveSupabaseConfig(overrides);
  if (!resolved) {
    throw new Error("Supabase URL and anon key must be configured.");
  }
  return resolved;
}
