import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { getSupabaseServiceConfig, optionalEnv } from "../_shared/env.ts";
import {
  AUTONOMY_CATEGORIES,
  AUTONOMY_LEVELS,
  COMPOSER_DIALS,
  isAutonomyCategory,
  isAutonomyLevel,
  isComposerDial,
  type AutonomyCategory,
  type AutonomyLevel,
  type ComposerDial,
} from "../_shared/autonomy.ts";
import fixture from "../../../ops/fixtures/user_autonomy_prefs.json" assert {
  type: "json",
};

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "user-autonomy" });
const USE_FIXTURES = optionalEnv("AUTONOMY_PREFS_FIXTURES") === "1";

interface AutonomyPreferencePayload {
  category: AutonomyCategory;
  level: AutonomyLevel;
  composer: ComposerDial;
  updatedAt?: string;
  source?: "db" | "fixtures" | "default";
}

interface AuthContext {
  userId: string | null;
  isService: boolean;
}

const JSON_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  "Accept-Profile": "app",
  "Content-Profile": "app",
} as const;

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("user-autonomy-save");
  }

  const auth = await resolveAuth(req);
  const queryUserId = url.searchParams.get("user_id");
  const targetUserId = auth.isService
    ? (queryUserId ?? (await extractBodyUserId(req, req.method))) ?? auth.userId
    : auth.userId;

  if (!targetUserId && !USE_FIXTURES) {
    return jsonResponse({ ok: false, error: "Authentication required" }, 401);
  }

  if (req.method === "GET") {
    if (USE_FIXTURES) {
      return jsonResponse({
        ok: true,
        source: "fixtures",
        preferences: normalizeFixtures(fixture.preferences ?? []),
      });
    }

    try {
      const preferences = await fetchPreferences(targetUserId);
      return jsonResponse({ ok: true, source: "db", preferences });
    } catch (error) {
      console.log(JSON.stringify({
        level: "WARN",
        event: "user.autonomy.fetch_failed",
        fn: "user-autonomy-save",
        request_id: requestId,
        message: (error as Error).message,
      }));
      return jsonResponse({
        ok: true,
        source: "fixtures",
        preferences: normalizeFixtures(fixture.preferences ?? []),
      }, 200);
    }
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const parsed = parsePayload(body);
  if (!parsed.ok) {
    return jsonResponse({ ok: false, errors: parsed.errors }, 400);
  }

  const resolvedUser = auth.isService && parsed.userId ? parsed.userId : targetUserId;

  if (USE_FIXTURES) {
    const merged = mergeFixtures(parsed.preferences);
    return jsonResponse({ ok: true, source: "fixtures", preferences: merged });
  }

  try {
    await upsertPreferences(resolvedUser, parsed.preferences);
    const preferences = await fetchPreferences(resolvedUser);
    return jsonResponse({ ok: true, source: "db", preferences });
  } catch (error) {
    console.log(JSON.stringify({
      level: "WARN",
      event: "user.autonomy.save_failed",
      fn: "user-autonomy-save",
      request_id: requestId,
      message: (error as Error).message,
    }));
    return jsonResponse({
      ok: true,
      source: "fixtures",
      preferences: normalizeFixtures(fixture.preferences ?? []),
    }, 200);
  }
}, { fn: "user-autonomy-save", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

async function resolveAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("authorization") ??
    req.headers.get("Authorization") ?? "";

  if (!authHeader) {
    return { userId: null, isService: false };
  }

  if (authHeader === `Bearer ${SERVICE_ROLE_KEY}`) {
    return { userId: null, isService: true };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      return { userId: null, isService: false };
    }

    const payload = await response.json() as { id?: string };
    if (payload?.id) {
      return { userId: payload.id, isService: false };
    }
  } catch (_error) {
    // ignore errors, fall through to anonymous context
  }

  return { userId: null, isService: false };
}

async function extractBodyUserId(req: Request, method: string): Promise<string | null> {
  if (method !== "POST") return null;
  try {
    const clone = req.clone();
    const parsed = await clone.json();
    if (parsed && typeof parsed.userId === "string") {
      return parsed.userId;
    }
  } catch (_error) {
    // ignore body parsing errors when probing for user id
  }
  return null;
}

function parsePayload(body: unknown):
  | { ok: true; preferences: AutonomyPreferencePayload[]; userId?: string }
  | { ok: false; errors: string[]; userId?: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, errors: ["Payload must be an object"] };
  }

  const errors: string[] = [];
  const preferencesRaw = (body as Record<string, unknown>).preferences;
  const maybeUserId = (body as Record<string, unknown>).userId;

  if (maybeUserId !== undefined && typeof maybeUserId !== "string") {
    errors.push("userId must be a string when provided");
  }

  if (!Array.isArray(preferencesRaw)) {
    errors.push("preferences must be an array");
    return { ok: false, errors, userId: typeof maybeUserId === "string" ? maybeUserId : undefined };
  }

  const preferences: AutonomyPreferencePayload[] = [];
  for (const [index, entry] of preferencesRaw.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`preferences[${index}] must be an object`);
      continue;
    }

    const category = (entry as Record<string, unknown>).category;
    const level = (entry as Record<string, unknown>).level;
    const composer = (entry as Record<string, unknown>).composer;

    if (!isAutonomyCategory(category)) {
      errors.push(`preferences[${index}].category must be one of ${AUTONOMY_CATEGORIES.join(", ")}`);
    }
    if (!isAutonomyLevel(level)) {
      errors.push(`preferences[${index}].level must be one of ${AUTONOMY_LEVELS.join(", ")}`);
    }
    if (!isComposerDial(composer)) {
      errors.push(`preferences[${index}].composer must be one of ${COMPOSER_DIALS.join(", ")}`);
    }

    if (
      isAutonomyCategory(category) &&
      isAutonomyLevel(level) &&
      isComposerDial(composer)
    ) {
      preferences.push({
        category,
        level,
        composer,
      });
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      userId: typeof maybeUserId === "string" ? maybeUserId : undefined,
    };
  }

  return {
    ok: true,
    preferences,
    userId: typeof maybeUserId === "string" ? maybeUserId : undefined,
  };
}

async function fetchPreferences(userId: string): Promise<AutonomyPreferencePayload[]> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/app.user_autonomy_prefs?select=category,autonomy_level,composer_mode,updated_at&user_id=eq.${userId}`,
    { headers: JSON_HEADERS },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  const rows = await response.json() as Array<Record<string, unknown>>;
  const preferences: AutonomyPreferencePayload[] = [];
  for (const row of rows) {
    if (
      isAutonomyCategory(row.category) &&
      isAutonomyLevel(row.autonomy_level) &&
      isComposerDial(row.composer_mode)
    ) {
      preferences.push({
        category: row.category,
        level: row.autonomy_level,
        composer: row.composer_mode,
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
        source: "db",
      });
    }
  }
  return preferences;
}

async function upsertPreferences(
  userId: string,
  preferences: AutonomyPreferencePayload[],
): Promise<void> {
  if (preferences.length === 0) return;
  const now = new Date().toISOString();
  const payload = preferences.map((pref) => ({
    user_id: userId,
    category: pref.category,
    autonomy_level: pref.level,
    composer_mode: pref.composer,
    updated_at: now,
  }));

  const response = await fetch(`${SUPABASE_URL}/rest/v1/app.user_autonomy_prefs`, {
    method: "POST",
    headers: {
      ...JSON_HEADERS,
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
}

function normalizeFixtures(raw: unknown[]): AutonomyPreferencePayload[] {
  const preferences: AutonomyPreferencePayload[] = [];
  for (const [index, entry] of raw.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const category = (entry as Record<string, unknown>).category;
    const level = (entry as Record<string, unknown>).level;
    const composer = (entry as Record<string, unknown>).composer;
    if (
      isAutonomyCategory(category) &&
      isAutonomyLevel(level) &&
      isComposerDial(composer)
    ) {
      preferences.push({
        category,
        level,
        composer,
        source: "fixtures",
        updatedAt: new Date(Date.now() - index * 1000).toISOString(),
      });
    }
  }
  return preferences;
}

function mergeFixtures(preferences: AutonomyPreferencePayload[]): AutonomyPreferencePayload[] {
  const baseline = normalizeFixtures(fixture.preferences ?? []);
  const map = new Map<AutonomyCategory, AutonomyPreferencePayload>();
  for (const pref of baseline) {
    map.set(pref.category, pref);
  }
  const now = new Date().toISOString();
  for (const pref of preferences) {
    map.set(pref.category, { ...pref, updatedAt: now, source: "fixtures" });
  }
  return Array.from(map.values());
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
