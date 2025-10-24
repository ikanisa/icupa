import type { SupabaseServiceConfig } from "./env.ts";

interface GrowthConfig extends SupabaseServiceConfig {
  offline: boolean;
  reason?: string;
}

interface ResolveGrowthOptions {
  offlineFlag?: string;
}

export function resolveGrowthConfig(options: ResolveGrowthOptions = {}): GrowthConfig {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const baseOffline = Deno.env.get("GROWTH_OFFLINE") === "1";
  const featureOffline = options.offlineFlag
    ? Deno.env.get(options.offlineFlag) === "1"
    : false;
  const missingCreds = !supabaseUrl || !serviceRoleKey;

  let reason: string | undefined;
  if (featureOffline) {
    reason = `${options.offlineFlag}_flag`;
  } else if (baseOffline) {
    reason = "GROWTH_OFFLINE_flag";
  } else if (missingCreds) {
    reason = "missing_supabase_credentials";
  }

  return {
    url: supabaseUrl,
    serviceRoleKey,
    offline: featureOffline || baseOffline || missingCreds,
    reason,
  };
}

export function buildGrowthHeaders(profile: string, serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    "Content-Profile": profile,
    "Accept-Profile": profile,
    Prefer: "return=representation",
  };
}

export function buildGetHeaders(profile: string, serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Accept-Profile": profile,
  };
}
