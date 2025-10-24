const cache = new Map<string, string>();

interface EnvOptions {
  example?: string;
  context?: string;
  allowEmpty?: boolean;
}

export function requireEnv(name: string, options: EnvOptions = {}): string {
  const cacheKey = `${name}:${options.allowEmpty ? "allow" : "required"}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) as string;
  }

  const raw = Deno.env.get(name) ?? "";
  const value = raw.trim();
  if (!options.allowEmpty && value === "") {
    const context = options.context ? `[${options.context}] ` : "";
    const hint = options.example ? ` (e.g., ${options.example})` : "";
    throw new Error(`${context}Missing required environment variable ${name}${hint}`);
  }

  const resolved = options.allowEmpty ? raw : value;
  cache.set(cacheKey, resolved);
  return resolved;
}

interface SupabaseServiceConfigOptions {
  feature?: string;
}

export interface SupabaseServiceConfig {
  url: string;
  serviceRoleKey: string;
}

let supabaseConfig: SupabaseServiceConfig | null = null;

export function getSupabaseServiceConfig(
  options: SupabaseServiceConfigOptions = {},
): SupabaseServiceConfig {
  if (supabaseConfig) return supabaseConfig;

  const url = requireEnv("SUPABASE_URL", {
    context: options.feature,
    example: "https://project.supabase.co",
  });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!serviceRoleKey) {
    const context = options.feature ? `[${options.feature}] ` : "";
    throw new Error(
      `${context}Missing required environment variable SUPABASE_SERVICE_ROLE or SUPABASE_SERVICE_ROLE_KEY`,
    );
  }

  supabaseConfig = { url, serviceRoleKey };
  return supabaseConfig;
}

export function optionalEnv(name: string): string | undefined {
  const value = Deno.env.get(name);
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}
