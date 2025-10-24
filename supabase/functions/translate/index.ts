import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import tmFixtures from "../../../ops/fixtures/translate_tm.json" assert { type: "json" };

import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { getSupabaseServiceConfig } from "../_shared/env.ts";

interface TranslateRequestBody {
  text?: unknown;
  source_lang?: unknown;
  target_lang?: unknown;
}

interface TmRow {
  id?: number;
  source_lang: string;
  target_lang: string;
  source_text: string;
  target_text: string;
  forward_hits: number;
  reverse_hits: number;
  updated_at?: string;
}

interface TranslateResponseBody {
  ok: true;
  source_lang: string;
  target_lang: string;
  source_text: string;
  target_text: string;
  origin: "tm" | "model";
  hits: { forward: number; reverse: number };
  request_id: string | null;
  persisted: boolean;
}

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "translate" });

const USE_FIXTURES =
  (Deno.env.get("USE_FIXTURES") ?? "0") === "1" || !SUPABASE_URL || !SERVICE_ROLE_KEY;

const SUPABASE_HEADERS = SERVICE_ROLE_KEY
  ? {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  }
  : {} as Record<string, string>;

const fixtureMap = new Map<string, TmRow>();
const fixtureReverseMap = new Map<string, TmRow>();

if (Array.isArray(tmFixtures)) {
  for (const raw of tmFixtures as TmRow[]) {
    if (raw?.source_lang && raw?.target_lang && raw?.source_text) {
      const entry: TmRow = {
        ...raw,
        source_lang: String(raw.source_lang).toLowerCase(),
        target_lang: String(raw.target_lang).toLowerCase(),
        source_text: String(raw.source_text),
        target_text: String(raw.target_text ?? ""),
        forward_hits: Number.isFinite(Number(raw.forward_hits))
          ? Number(raw.forward_hits)
          : 0,
        reverse_hits: Number.isFinite(Number(raw.reverse_hits))
          ? Number(raw.reverse_hits)
          : 0,
      };
      setFixtureEntry(entry);
    }
  }
}

const handler = withObs(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("translate");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const requestId = getRequestId(req) ?? crypto.randomUUID();

  let payload: TranslateRequestBody;
  try {
    payload = await req.json() as TranslateRequestBody;
  } catch (_error) {
    const err = new Error("invalid_json_body");
    (err as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw err;
  }

  const sourceLang = normalizeLang(payload.source_lang);
  const targetLang = normalizeLang(payload.target_lang);
  const sourceText = normalizeText(payload.text);

  if (!sourceLang || !targetLang || !sourceText) {
    const err = new Error("source_lang, target_lang, and text are required");
    (err as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw err;
  }

  if (sourceLang === targetLang) {
    const err = new Error("source_lang and target_lang must differ");
    (err as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw err;
  }

  const direction = `${sourceLang}>${targetLang}`;

  console.log(JSON.stringify({
    level: "AUDIT",
    event: "translate.lookup",
    fn: "translate",
    requestId,
    direction,
    text: sourceText,
    fixtureMode: USE_FIXTURES,
  }));

  const tmHit = await lookupTranslation({ sourceLang, targetLang, sourceText });
  if (tmHit) {
    const updated = await incrementHit({
      sourceLang,
      targetLang,
      sourceText,
      targetText: tmHit.target_text,
      reverse: false,
    });

    console.log(JSON.stringify({
      level: "INFO",
      event: "translate.tm_hit",
      fn: "translate",
      requestId,
      direction,
      hits: { forward: updated.forward_hits, reverse: updated.reverse_hits },
    }));

    return jsonResponse<TranslateResponseBody>({
      ok: true,
      source_lang: sourceLang,
      target_lang: targetLang,
      source_text: sourceText,
      target_text: updated.target_text,
      origin: "tm",
      hits: { forward: updated.forward_hits, reverse: updated.reverse_hits },
      request_id: requestId,
      persisted: updated.persisted,
    });
  }

  const reverseHit = await lookupReverseTranslation({
    sourceLang,
    targetLang,
    sourceText,
  });
  if (reverseHit) {
    const updated = await incrementHit({
      sourceLang: reverseHit.row.source_lang,
      targetLang: reverseHit.row.target_lang,
      sourceText: reverseHit.row.source_text,
      targetText: reverseHit.row.target_text,
      reverse: true,
    });

    console.log(JSON.stringify({
      level: "INFO",
      event: "translate.tm_reverse_hit",
      fn: "translate",
      requestId,
      direction,
      hits: { forward: updated.forward_hits, reverse: updated.reverse_hits },
    }));

    return jsonResponse<TranslateResponseBody>({
      ok: true,
      source_lang: sourceLang,
      target_lang: targetLang,
      source_text: sourceText,
      target_text: reverseHit.translation,
      origin: "tm",
      hits: { forward: updated.forward_hits, reverse: updated.reverse_hits },
      request_id: requestId,
      persisted: updated.persisted,
    });
  }

  const modelResult = await runFixtureModel({
    sourceLang,
    targetLang,
    sourceText,
  });

  const saved = await persistTranslation({
    sourceLang,
    targetLang,
    sourceText,
    targetText: modelResult.translation,
  });

  console.log(JSON.stringify({
    level: "INFO",
    event: "translate.model_fallback",
    fn: "translate",
    requestId,
    direction,
    origin: modelResult.origin,
  }));

  return jsonResponse<TranslateResponseBody>({
    ok: true,
    source_lang: sourceLang,
    target_lang: targetLang,
    source_text: sourceText,
    target_text: saved.target_text,
    origin: "model",
    hits: { forward: saved.forward_hits, reverse: saved.reverse_hits },
    request_id: requestId,
    persisted: saved.persisted,
  });
}, { fn: "translate" });

serve(handler);

function normalizeLang(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!/^([a-z]{2,3})(-[a-z]{2})?$/.test(normalized)) return null;
  return normalized;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function tmKey(source: string, target: string, text: string): string {
  return `${source}::${target}::${text}`;
}

function setFixtureEntry(entry: TmRow) {
  fixtureMap.set(tmKey(entry.source_lang, entry.target_lang, entry.source_text), entry);
  fixtureReverseMap.set(tmKey(entry.target_lang, entry.source_lang, entry.target_text), entry);
}

async function lookupTranslation(input: {
  sourceLang: string;
  targetLang: string;
  sourceText: string;
}): Promise<TmRow | null> {
  if (USE_FIXTURES) {
    const entry = fixtureMap.get(tmKey(input.sourceLang, input.targetLang, input.sourceText));
    return entry ? { ...entry } : null;
  }

  const params = new URLSearchParams();
  params.set("select", "id,source_lang,target_lang,source_text,target_text,forward_hits,reverse_hits,updated_at");
  params.set("source_lang", `eq.${input.sourceLang}`);
  params.set("target_lang", `eq.${input.targetLang}`);
  params.set("source_text", `eq.${input.sourceText}`);
  params.set("limit", "1");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/comms.tm?${params.toString()}`, {
    headers: {
      ...SUPABASE_HEADERS,
      "Accept-Profile": "comms",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`tm lookup failed: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.UNKNOWN;
    throw error;
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) return null;
  return rows[0] as TmRow;
}

async function lookupReverseTranslation(input: {
  sourceLang: string;
  targetLang: string;
  sourceText: string;
}): Promise<{ row: TmRow; translation: string } | null> {
  if (USE_FIXTURES) {
    const entry = fixtureReverseMap.get(tmKey(input.sourceLang, input.targetLang, input.sourceText));
    if (!entry) return null;
    return { row: { ...entry }, translation: entry.source_text };
  }

  const params = new URLSearchParams();
  params.set("select", "id,source_lang,target_lang,source_text,target_text,forward_hits,reverse_hits,updated_at");
  params.set("source_lang", `eq.${input.targetLang}`);
  params.set("target_lang", `eq.${input.sourceLang}`);
  params.set("target_text", `eq.${input.sourceText}`);
  params.set("limit", "1");

  const response = await fetch(`${SUPABASE_URL}/rest/v1/comms.tm?${params.toString()}`, {
    headers: {
      ...SUPABASE_HEADERS,
      "Accept-Profile": "comms",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`tm reverse lookup failed: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.UNKNOWN;
    throw error;
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) return null;
  const row = rows[0] as TmRow;
  return { row, translation: row.source_text };
}

async function incrementHit(input: {
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  targetText: string;
  reverse: boolean;
}): Promise<TmRow & { persisted: boolean }> {
  if (USE_FIXTURES) {
    const key = tmKey(input.sourceLang, input.targetLang, input.sourceText);
    const existing = fixtureMap.get(key);
    if (!existing) {
      const fresh: TmRow = {
        source_lang: input.sourceLang,
        target_lang: input.targetLang,
        source_text: input.sourceText,
        target_text: input.targetText,
        forward_hits: input.reverse ? 0 : 1,
        reverse_hits: input.reverse ? 1 : 0,
      };
      setFixtureEntry(fresh);
      return { ...fresh, persisted: false };
    }
    const forwardHits = existing.forward_hits + (input.reverse ? 0 : 1);
    const reverseHits = existing.reverse_hits + (input.reverse ? 1 : 0);
    fixtureReverseMap.delete(tmKey(existing.target_lang, existing.source_lang, existing.target_text));
    const updated: TmRow = {
      ...existing,
      target_text: input.targetText,
      forward_hits: forwardHits,
      reverse_hits: reverseHits,
    };
    setFixtureEntry(updated);
    return { ...updated, persisted: false };
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/comms_upsert_tm_entry`, {
    method: "POST",
    headers: {
      ...SUPABASE_HEADERS,
      "Content-Type": "application/json",
      Prefer: "params=single-object",
    },
    body: JSON.stringify({
      p_source_lang: input.sourceLang,
      p_target_lang: input.targetLang,
      p_source_text: input.sourceText,
      p_target_text: input.targetText,
      p_increment_forward: !input.reverse,
      p_increment_reverse: input.reverse,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`tm increment failed: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }

  const rows = await response.json();
  const row = Array.isArray(rows) && rows[0] ? rows[0] as TmRow : null;
  if (!row) {
    const error = new Error("tm increment returned empty result");
    (error as { code?: string }).code = ERROR_CODES.UNKNOWN;
    throw error;
  }
  return { ...row, persisted: true };
}

async function persistTranslation(input: {
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  targetText: string;
}): Promise<TmRow & { persisted: boolean }> {
  return await incrementHit({
    sourceLang: input.sourceLang,
    targetLang: input.targetLang,
    sourceText: input.sourceText,
    targetText: input.targetText,
    reverse: false,
  });
}

async function runFixtureModel(input: {
  sourceLang: string;
  targetLang: string;
  sourceText: string;
}): Promise<{ translation: string; origin: string }> {
  const deterministic = fixtureMap.get(tmKey(input.sourceLang, input.targetLang, input.sourceText));
  if (deterministic) {
    return { translation: deterministic.target_text, origin: "fixture" };
  }
  const reverse = fixtureReverseMap.get(tmKey(input.sourceLang, input.targetLang, input.sourceText));
  if (reverse) {
    return { translation: reverse.source_text, origin: "reverse_fixture" };
  }
  const synthetic = `[${input.targetLang}] ${input.sourceText}`;
  return { translation: synthetic, origin: "synthetic" };
}

function jsonResponse<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
