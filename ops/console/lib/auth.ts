import { cookies } from "next/headers";
import { determineOpsDataMode, readSupabaseConfig } from "./env";
import { emitBypassAlert } from "./bypass-alert";

type AccessDeniedReason =
  | "config_missing"
  | "missing_session"
  | "invalid_session"
  | "profile_fetch_failed"
  | "profile_missing"
  | "persona_forbidden"
  | "network_error";

export type OpsAccessFailure = {
  ok: false;
  reason: AccessDeniedReason;
  message: string;
};

export type OpsAccessGrant = {
  ok: true;
  userId: string;
  email: string | null;
  persona: string;
  bypassed: boolean;
};

export type OpsAccessResult = OpsAccessGrant | OpsAccessFailure;

export async function verifyOpsAccess(): Promise<OpsAccessResult> {
  const mode = determineOpsDataMode();
  if (mode.mode === "blocked") {
    await emitBypassAlert({
      page: "auth",
      toggles: mode.toggles,
      reason: mode.reason,
    });
    return {
      ok: false,
      reason: "config_missing",
      message: `${mode.reason} Disable toggles: ${mode.toggles.join(', ')}`.trim(),
    };
  }

  if (mode.mode === "fixtures") {
    return {
      ok: true,
      userId: "offline-ops",
      email: null,
      persona: "ops",
      bypassed: true,
    };
  }

  const configState = readSupabaseConfig();
  if (!configState.ok) {
    return {
      ok: false,
      reason: "config_missing",
      message: `Missing Supabase env: ${configState.missing.join(", ")}`,
    };
  }

  const accessToken = cookies().get("sb-access-token")?.value;
  if (!accessToken) {
    return {
      ok: false,
      reason: "missing_session",
      message: "Sign in required. Supabase access token cookie not found.",
    };
  }

  const { url, anonKey } = configState.config;

  const authHeaders = {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  } as const;

  let userResponse: Response;
  try {
    userResponse = await fetch(`${url}/auth/v1/user`, {
      headers: authHeaders,
      cache: "no-store",
    });
  } catch (error) {
    return {
      ok: false,
      reason: "network_error",
      message: `Failed to reach Supabase auth: ${(error as Error).message}`,
    };
  }

  if (!userResponse.ok) {
    return {
      ok: false,
      reason: "invalid_session",
      message: `Auth check failed (${userResponse.status}). Refresh sign-in.`,
    };
  }

  const userPayload = await userResponse.json() as
    | { id?: string; email?: string | null }
    | null;
  const userId = typeof userPayload?.id === "string" ? userPayload.id : null;

  if (!userId) {
    return {
      ok: false,
      reason: "invalid_session",
      message: "Auth response missing user id.",
    };
  }

  const profileUrl =
    `${url}/rest/v1/core.profiles?select=persona&auth_user_id=eq.${encodeURIComponent(userId)}`;

  let profileResponse: Response;
  try {
    profileResponse = await fetch(profileUrl, {
      headers: authHeaders,
      cache: "no-store",
    });
  } catch (error) {
    return {
      ok: false,
      reason: "network_error",
      message: `Failed to reach Supabase profile view: ${(error as Error).message}`,
    };
  }

  if (!profileResponse.ok) {
    return {
      ok: false,
      reason: "profile_fetch_failed",
      message: `Profile lookup failed (${profileResponse.status}).`,
    };
  }

  const profileRows = await profileResponse.json() as Array<{ persona?: string }>;
  if (!Array.isArray(profileRows) || profileRows.length === 0) {
    return {
      ok: false,
      reason: "profile_missing",
      message: "No profile row found for the authenticated user.",
    };
  }

  const persona = profileRows[0]?.persona;
  if (persona !== "ops") {
    return {
      ok: false,
      reason: "persona_forbidden",
      message: `Persona ${persona ?? "<unknown>"} lacks ops access.`,
    };
  }

  return {
    ok: true,
    userId,
    email: userPayload?.email ?? null,
    persona,
    bypassed: false,
  };
}
