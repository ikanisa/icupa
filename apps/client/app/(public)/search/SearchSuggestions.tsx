"use client";

import type { SearchPlace } from "@ecotrips/types";
import { useMemo } from "react";

import type { SearchSource } from "./utils";
import { normalizeTokens } from "./utils";

interface SearchSuggestionsProps {
  query: string;
  items: SearchPlace[];
  status: "idle" | "loading" | "ready" | "offline" | "error";
  fallback: boolean;
  source: SearchSource;
  error?: string;
  visible: boolean;
  onSelect: (item: SearchPlace) => void;
}

export function SearchSuggestions({
  query,
  items,
  status,
  fallback,
  source,
  error,
  visible,
  onSelect,
}: SearchSuggestionsProps) {
  const tokens = useMemo(() => normalizeTokens(query), [query]);

  if (!visible) {
    return null;
  }

  return (
    <div className="relative">
      <div className="absolute z-20 mt-2 w-full rounded-2xl border border-white/10 bg-black/80 p-2 text-sm shadow-xl shadow-black/40 backdrop-blur">
        {items.length === 0 ? (
          <div className="px-3 py-4 text-white/70">No matching places yet.</div>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.slug}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(item)}
                  className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/10 focus:bg-white/15"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-white">
                      {renderHighlightedText(item.title, tokens)}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-white/40">{item.entityType}</span>
                  </div>
                  {item.subtitle && (
                    <p className="mt-1 text-xs text-white/70">
                      {renderHighlightedText(item.subtitle, tokens)}
                    </p>
                  )}
                  {typeof item.metadata?.summary === "string" && (
                    <p className="mt-1 text-[11px] text-white/50">
                      {renderHighlightedText(item.metadata.summary as string, tokens)}
                    </p>
                  )}
                  {item.matches.length > 0 && (
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-white/30">
                      Matched {item.matches.map((match) => match.field).join(", ")}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-[11px] text-white/60">
          <span>
            {status === "loading"
              ? "Searching places…"
              : fallback
              ? "Offline fixtures ready"
              : source === "catalog"
              ? "Live catalog index"
              : "Curated fixtures"}
          </span>
          {error && status === "error" && <span className="text-rose-200">{error}</span>}
        </div>
      </div>
    </div>
  );
}

function renderHighlightedText(text: string, tokens: string[]) {
  if (!text) return null;
  if (tokens.length === 0) return text;
  const escaped = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (escaped.length === 0) return text;
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, index) => {
    const lower = part.toLowerCase();
    const isMatch = tokens.some((token) => token.toLowerCase() === lower);
    return isMatch ? (
      <mark key={`${part}-${index}`} className="rounded bg-white/30 px-0.5">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    );
  });
}
