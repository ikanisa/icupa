"use client";

import { useMemo, useState } from "react";
import { Button } from "@ecotrips/ui";
import { clsx } from "clsx";

type TmRow = {
  id?: number;
  source_lang: string;
  target_lang: string;
  source_text: string;
  target_text: string;
  forward_hits: number;
  reverse_hits: number;
  updated_at?: string;
};

type Props = {
  initialRows: TmRow[];
};

type DraftState = {
  id?: number;
  source_lang: string;
  target_lang: string;
  source_text: string;
  draft: string;
};

const inputClass = "w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400/60";
const selectClass = "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-400/60";
const textareaClass = "min-h-[120px] w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400/60";

export function TmBrowser({ initialRows }: Props) {
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("all");
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [editNote, setEditNote] = useState<string>("");

  const normalizedRows = useMemo(() => {
    return initialRows.map((row) => ({
      ...row,
      source_lang: row.source_lang.toLowerCase(),
      target_lang: row.target_lang.toLowerCase(),
      source_text: row.source_text,
      target_text: row.target_text,
      forward_hits: row.forward_hits,
      reverse_hits: row.reverse_hits,
      updated_at: row.updated_at ?? "—",
    }));
  }, [initialRows]);

  const directions = useMemo(() => {
    const set = new Set<string>();
    for (const row of normalizedRows) {
      set.add(`${row.source_lang}>${row.target_lang}`);
    }
    return Array.from(set).sort();
  }, [normalizedRows]);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    return normalizedRows.filter((row) => {
      if (direction !== "all" && `${row.source_lang}>${row.target_lang}` !== direction) {
        return false;
      }
      if (!trimmed) return true;
      return row.source_text.toLowerCase().includes(trimmed) ||
        row.target_text.toLowerCase().includes(trimmed);
    });
  }, [normalizedRows, direction, query]);

  const handleEdit = (row: TmRow) => {
    setDraft({
      id: row.id,
      source_lang: row.source_lang,
      target_lang: row.target_lang,
      source_text: row.source_text,
      draft: row.target_text,
    });
    setEditNote("");
  };

  const handleSaveMock = () => {
    if (!draft) return;
    console.log("tm.edit.mock", {
      id: draft.id,
      direction: `${draft.source_lang}>${draft.target_lang}`,
      source: draft.source_text,
      nextTranslation: draft.draft,
      note: editNote,
    });
    setDraft(null);
    setEditNote("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          className={clsx(inputClass, "max-w-md flex-1")}
          placeholder="Search source or target text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className={clsx(selectClass, "w-full sm:w-auto")}
          value={direction}
          onChange={(event) => setDirection(event.target.value)}
        >
          <option value="all">All directions</option>
          {directions.map((dir) => (
            <option key={dir} value={dir}>
              {dir.replace(">", " → ")}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs uppercase tracking-wide text-white/40">
        {filtered.length} translation{filtered.length === 1 ? "" : "s"} visible · mock editing only
      </p>
      <div className="grid gap-3">
        {filtered.map((row) => (
          <div
            key={`${row.source_lang}:${row.target_lang}:${row.source_text}`}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-slate-950/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-sky-200/80">
                  {row.source_lang} → {row.target_lang}
                </p>
                <p className="text-sm text-white/80">{row.source_text}</p>
                <p className="text-sm text-emerald-200/90">{row.target_text}</p>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs text-white/60">
                <p>Hits: {row.forward_hits} fwd · {row.reverse_hits} rev</p>
                <p>Updated: {row.updated_at}</p>
                <Button
                  variant="glass"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => handleEdit(row)}
                >
                  Edit translation
                </Button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/70">
            No translation memory entries match the filters.
          </div>
        )}
      </div>
      {draft && (
        <div className="space-y-4 rounded-3xl border border-sky-500/30 bg-sky-500/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-white">Edit translation mock</h3>
            <Button
              variant="secondary"
              className="px-3 py-1.5 text-xs"
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs uppercase tracking-wide text-white/50">Source ({draft.source_lang})</p>
            <p className="text-sm text-white/80">{draft.source_text}</p>
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-wide text-white/60">
              Target ({draft.target_lang})
            </label>
            <textarea
              className={textareaClass}
              value={draft.draft}
              onChange={(event) =>
                setDraft((current) => current
                  ? { ...current, draft: event.target.value }
                  : current)}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-wide text-white/60">
              Operator note
            </label>
            <input
              type="text"
              className={inputClass}
              placeholder="Document rationale for translation change"
              value={editNote}
              onChange={(event) => setEditNote(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
            <Button variant="primary" className="px-4 py-2" onClick={handleSaveMock}>
              Save mock update
            </Button>
            <p>Persisted writes wire up once translate edge function allows admin tokens.</p>
          </div>
        </div>
      )}
    </div>
  );
}
