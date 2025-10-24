import type { SearchPlace } from "@ecotrips/types";
import { searchIndexFixtures, type SearchIndexFixture } from "../../../../../supabase/shared/catalogFixtures";

export type SearchSource = "catalog" | "fixtures";

export function normalizeTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 6);
}

export function buildFixtureResults(query: string, limit: number): SearchPlace[] {
  const tokens = normalizeTokens(query);
  const scored = searchIndexFixtures.map((fixture) => scoreFixture(fixture, tokens));
  const filtered = tokens.length > 0 ? scored.filter((item) => item.score > 0) : scored;
  const ranked = filtered.length > 0 ? filtered : scored;
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.title.localeCompare(b.title);
  });
  return ranked.slice(0, limit);
}

export function scoreFixture(
  fixture: SearchIndexFixture,
  tokens: string[],
): SearchPlace {
  const base: SearchPlace = {
    slug: fixture.slug,
    entityType: fixture.entityType,
    entityId: fixture.entityId,
    title: fixture.title,
    subtitle: fixture.subtitle ?? null,
    keywords: fixture.keywords,
    metadata: fixture.metadata,
    score: 1,
    matches: [],
  };

  if (tokens.length === 0) {
    return base;
  }

  let score = 0;
  const matches = new Map<string, Set<string>>();
  const title = fixture.title.toLowerCase();
  const subtitle = (fixture.subtitle ?? "").toLowerCase();
  const summary = typeof fixture.metadata.summary === "string"
    ? fixture.metadata.summary.toLowerCase()
    : "";
  const tags = Array.isArray(fixture.metadata.tags)
    ? fixture.metadata.tags.map((tag) => String(tag).toLowerCase())
    : [];
  const keywords = fixture.keywords.map((keyword) => keyword.toLowerCase());

  for (const token of tokens) {
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
    if (fixture.slug.toLowerCase().includes(token)) {
      score += 2;
      trackMatch(matches, "slug", token);
    }
  }

  const matchList = Array.from(matches.entries()).map(([field, terms]) => ({
    field,
    terms: Array.from(terms.values()),
  }));

  return {
    ...base,
    score: Math.max(score, 0),
    matches: matchList,
  };
}

function trackMatch(collection: Map<string, Set<string>>, field: string, token: string) {
  const bucket = collection.get(field) ?? new Set<string>();
  bucket.add(token);
  collection.set(field, bucket);
}
