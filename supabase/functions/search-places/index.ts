import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { getSupabaseServiceConfig } from "../_shared/env.ts";
import { searchIndexFixtures, type SearchIndexFixture } from "../../shared/catalogFixtures.ts";

type CatalogRow = {
  slug: string;
  entity_type: string;
  entity_id: string;
  title: string;
  subtitle: string | null;
  keywords: string[] | null;
  metadata: Record<string, unknown> | null;
};

type NormalizedEntry = {
  slug: string;
  entityType: string;
  entityId: string;
  title: string;
  subtitle: string | null;
  keywords: string[];
  metadata: Record<string, unknown>;
};

type MatchDescriptor = { field: string; terms: string[] };

type SearchResponseItem = NormalizedEntry & {
  score: number;
  matches: MatchDescriptor[];
};

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("search-places");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST required" }, 405);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch (_error) {
    body = {};
  }

  const rawQuery = typeof body.query === "string" ? body.query : "";
  const query = rawQuery.trim();
  const rawLimit = Number(body.limit ?? 5);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(12, Math.floor(rawLimit)))
    : 5;

  const tokens = normalizeTokens(query);

  let source: "catalog" | "fixtures" = "fixtures";
  let fallback = false;
  let entries: NormalizedEntry[] = [];

  try {
    const config = getSupabaseServiceConfig({ feature: "catalog" });
    const response = await fetch(
      `${config.url}/rest/v1/catalog.search_index?select=slug,entity_type,entity_id,title,subtitle,keywords,metadata`,
      {
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
          "Accept-Profile": "catalog",
        },
      },
    );

    if (response.ok) {
      const payload = (await response.json()) as CatalogRow[];
      entries = payload.map(normalizeRow);
      source = "catalog";
    } else {
      const text = await response.text();
      console.warn(
        JSON.stringify({
          level: "WARN",
          event: "catalog.search_index.fetch_failed",
          fn: "search-places",
          requestId,
          status: response.status,
          body: text,
        }),
      );
      entries = searchIndexFixtures.map(normalizeFixture);
      fallback = true;
      source = "fixtures";
    }
  } catch (error) {
    entries = searchIndexFixtures.map(normalizeFixture);
    fallback = true;
    source = "fixtures";
    console.warn(
      JSON.stringify({
        level: "WARN",
        event: "catalog.search_index.fetch_exception",
        fn: "search-places",
        requestId,
        message: (error as Error).message,
      }),
    );
  }

  if (entries.length === 0) {
    entries = searchIndexFixtures.map(normalizeFixture);
    fallback = true;
    source = "fixtures";
  }

  let scored = entries.map((entry) => scoreEntry(entry, tokens));

  if (tokens.length > 0) {
    scored = scored.filter((item) => item.score > 0);
  }

  if (scored.length === 0) {
    scored = entries
      .slice(0, limit)
      .map((entry, index) => ({
        ...entry,
        score: Math.max(1, limit - index),
        matches: [],
      }));
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.title.localeCompare(b.title);
  });

  const items = scored.slice(0, limit);

  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "catalog.search_index.query",
      fn: "search-places",
      requestId,
      query,
      tokens,
      limit,
      source,
      fallback,
      results: items.length,
    }),
  );

  return jsonResponse({
    ok: true,
    requestId,
    query,
    items,
    source,
    fallback,
  });
}, { fn: "search-places", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function normalizeRow(row: CatalogRow): NormalizedEntry {
  return {
    slug: row.slug,
    entityType: row.entity_type,
    entityId: row.entity_id,
    title: row.title,
    subtitle: row.subtitle ?? null,
    keywords: Array.isArray(row.keywords)
      ? row.keywords.map((keyword) => String(keyword))
      : [],
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata
        : {},
  };
}

function normalizeFixture(fixture: SearchIndexFixture): NormalizedEntry {
  return {
    slug: fixture.slug,
    entityType: fixture.entityType,
    entityId: fixture.entityId,
    title: fixture.title,
    subtitle: fixture.subtitle ?? null,
    keywords: fixture.keywords,
    metadata: fixture.metadata,
  };
}

function normalizeTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 6);
}

function scoreEntry(entry: NormalizedEntry, tokens: string[]): SearchResponseItem {
  if (tokens.length === 0) {
    return { ...entry, score: 1, matches: [] };
  }

  let score = 0;
  const matches = new Map<string, Set<string>>();
  const title = entry.title.toLowerCase();
  const subtitle = (entry.subtitle ?? "").toLowerCase();
  const summary = typeof entry.metadata.summary === "string"
    ? entry.metadata.summary.toLowerCase()
    : "";
  const tags = Array.isArray(entry.metadata.tags)
    ? entry.metadata.tags.map((tag) => String(tag).toLowerCase())
    : [];
  const keywords = entry.keywords.map((keyword) => keyword.toLowerCase());

  for (const token of tokens) {
    if (!token) continue;
    if (title.includes(token)) {
      score += title.startsWith(token) ? 12 : 8;
      trackMatch(matches, "title", token);
    }
    if (subtitle.includes(token)) {
      score += 4;
      trackMatch(matches, "subtitle", token);
    }
    if (summary.includes(token)) {
      score += 3;
      trackMatch(matches, "summary", token);
    }
    if (keywords.some((keyword) => keyword.includes(token))) {
      score += 6;
      trackMatch(matches, "keywords", token);
    }
    if (tags.some((tag) => tag.includes(token))) {
      score += 3;
      trackMatch(matches, "tags", token);
    }
    if (entry.slug.toLowerCase().includes(token)) {
      score += 2;
      trackMatch(matches, "slug", token);
    }
  }

  const matchList: MatchDescriptor[] = Array.from(matches.entries()).map(([field, terms]) => ({
    field,
    terms: Array.from(terms.values()),
  }));

  return { ...entry, score, matches: matchList };
}

function trackMatch(collection: Map<string, Set<string>>, field: string, token: string) {
  const bucket = collection.get(field) ?? new Set<string>();
  bucket.add(token);
  collection.set(field, bucket);
}
