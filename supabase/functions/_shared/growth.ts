import type { SupabaseServiceConfig } from "./env.ts";

interface GrowthConfig extends SupabaseServiceConfig {
  offline: boolean;
  reason?: string;
}

interface ResolveGrowthOptions {
  offlineFlag?: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export function resolveGrowthConfig(options: ResolveGrowthOptions = {}): GrowthConfig {
  const baseOffline = Deno.env.get("GROWTH_OFFLINE") === "1";
  const featureOffline = options.offlineFlag
    ? Deno.env.get(options.offlineFlag) === "1"
    : false;
  const missingCreds = !SUPABASE_URL || !SERVICE_ROLE_KEY;

  let reason: string | undefined;
  if (featureOffline) {
    reason = `${options.offlineFlag}_flag`;
  } else if (baseOffline) {
    reason = "GROWTH_OFFLINE_flag";
  } else if (missingCreds) {
    reason = "missing_supabase_credentials";
  }

  return {
    url: SUPABASE_URL,
    serviceRoleKey: SERVICE_ROLE_KEY,
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

export interface GrowthAuthInfo {
  type: "anonymous" | "service_role" | "user" | "invalid";
  userId: string | null;
  actorLabel: string;
}

export async function resolveGrowthAuth(req: Request): Promise<GrowthAuthInfo> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return { type: "anonymous", userId: null, actorLabel: "anonymous" };
  }

  if (SERVICE_ROLE_KEY && authHeader === `Bearer ${SERVICE_ROLE_KEY}`) {
    return { type: "service_role", userId: null, actorLabel: "service-role" };
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return { type: "invalid", userId: null, actorLabel: "unknown" };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      return { type: "invalid", userId: null, actorLabel: "unauthorized" };
    }

    const payload = await response.json();
    const userId = typeof payload?.id === "string" ? payload.id : null;
    if (!userId) {
      return { type: "invalid", userId: null, actorLabel: "unauthorized" };
    }

    return { type: "user", userId, actorLabel: userId };
  } catch (_error) {
    return { type: "invalid", userId: null, actorLabel: "unknown" };
  }
}

export function isGrowthAuthorized(
  auth: GrowthAuthInfo,
  options: { allowServiceRole?: boolean; allowUser?: boolean },
): boolean {
  if (auth.type === "service_role") {
    return options.allowServiceRole === true;
  }
  if (auth.type === "user") {
    return options.allowUser === true;
  }
  return false;
}

export function logGrowthAuthFailure(details: {
  fn: string;
  requestId: string;
  auth: GrowthAuthInfo;
  required: string;
  status: number;
}): void {
  console.log(JSON.stringify({
    level: "WARN",
    event: "growth.auth_denied",
    fn: details.fn,
    request_id: details.requestId,
    actor: details.auth.actorLabel,
    actor_type: details.auth.type,
    required: details.required,
    status: details.status,
  }));
}
