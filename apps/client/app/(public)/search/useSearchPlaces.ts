"use client";

import { useEffect, useMemo, useState } from "react";
import { createEcoTripsFunctionClient } from "@ecotrips/api";
import type { SearchPlace } from "@ecotrips/types";

import { buildFixtureResults, normalizeTokens, type SearchSource } from "./utils";

type SearchStatus = "idle" | "loading" | "ready" | "offline" | "error";

interface SearchState {
  items: SearchPlace[];
  status: SearchStatus;
  source: SearchSource;
  fallback: boolean;
  query: string;
  error?: string;
  tokens: string[];
}

const DEFAULT_LIMIT = 6;

export function useSearchPlaces(rawQuery: string, limit = DEFAULT_LIMIT): SearchState {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const [state, setState] = useState<SearchState>(() => ({
    items: buildFixtureResults("", limit),
    status: "idle",
    source: "fixtures",
    fallback: true,
    query: "",
    tokens: [],
  }));

  const client = useMemo(() => {
    if (!supabaseUrl || !anonKey) return null;
    return createEcoTripsFunctionClient({
      supabaseUrl,
      anonKey,
      getAccessToken: async () => null,
    });
  }, [supabaseUrl, anonKey]);

  useEffect(() => {
    const trimmed = rawQuery.trim();

    if (trimmed.length < 2) {
      const items = buildFixtureResults(trimmed, limit);
      const tokens = normalizeTokens(trimmed);
      setState({
        items,
        status: "idle",
        source: "fixtures",
        fallback: true,
        query: trimmed,
        tokens,
      });
      return;
    }

    if (!client) {
      const items = buildFixtureResults(trimmed, limit);
      const tokens = normalizeTokens(trimmed);
      setState({
        items,
        status: "offline",
        source: "fixtures",
        fallback: true,
        query: trimmed,
        tokens,
        error: undefined,
      });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const debounce = setTimeout(async () => {
      setState((prev) => ({
        ...prev,
        status: "loading",
        query: trimmed,
      }));

      try {
        const response = await client.call(
          "search.places",
          { query: trimmed, limit },
          { signal: controller.signal },
        );

        if (cancelled) {
          return;
        }

        const tokens = normalizeTokens(response.query ?? trimmed);
        setState({
          items: response.items,
          status: "ready",
          source: response.source,
          fallback: Boolean(response.fallback),
          query: response.query ?? trimmed,
          tokens,
          error: undefined,
        });
      } catch (error) {
        if (cancelled) return;
        console.error("search.places failed", error);
        const items = buildFixtureResults(trimmed, limit);
        const tokens = normalizeTokens(trimmed);
        setState({
          items,
          status: "error",
          source: "fixtures",
          fallback: true,
          query: trimmed,
          tokens,
          error: (error as Error).message,
        });
      }
    }, 220);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(debounce);
    };
  }, [rawQuery, client, limit]);

  return state;
}
