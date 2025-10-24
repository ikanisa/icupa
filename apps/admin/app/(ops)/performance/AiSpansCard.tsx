"use client";

import { useMemo, useState } from "react";
import { CardGlass } from "@ecotrips/ui";
import type { AiSpanFixture } from "./fixtures";

type SortMode = "duration" | "error";

const startedFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function AiSpansCard({ spans }: { spans: AiSpanFixture[] }) {
  const [sortMode, setSortMode] = useState<SortMode>("duration");

  const sorted = useMemo(() => {
    const copy = [...spans];
    if (sortMode === "duration") {
      return copy.sort((a, b) => b.durationMs - a.durationMs);
    }
    return copy.sort((a, b) => {
      if (a.ok === b.ok) {
        return b.durationMs - a.durationMs;
      }
      return a.ok ? 1 : -1;
    });
  }, [spans, sortMode]);

  return (
    <CardGlass
      title="AI spans"
      subtitle="Sample span telemetry with hashed payloads. Sort to review slow or failing tools."
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm text-slate-300/80">
          {sortMode === "duration"
            ? "Showing longest running tool calls first."
            : "Showing tool errors first, then by duration."}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSortMode("duration")}
            className={`rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${sortMode === "duration" ? "border-emerald-400 text-emerald-300" : "border-white/10 text-slate-300/80 hover:border-white/30 hover:text-slate-100"}`}
          >
            Duration
          </button>
          <button
            type="button"
            onClick={() => setSortMode("error")}
            className={`rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${sortMode === "error" ? "border-rose-400 text-rose-300" : "border-white/10 text-slate-300/80 hover:border-white/30 hover:text-slate-100"}`}
          >
            Errors
          </button>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-300/80">
              <th className="pb-3">Tool</th>
              <th className="pb-3">Agent</th>
              <th className="pb-3">Request</th>
              <th className="pb-3">Started</th>
              <th className="pb-3">Duration (ms)</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Outcome</th>
              <th className="pb-3">Primary hash</th>
              <th className="pb-3">Tokens</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {sorted.map((span) => {
              const primaryHash = selectPrimaryHash(span);
              const started = startedFormatter.format(new Date(span.startedAt));
              return (
                <tr key={span.id}>
                  <td className="py-3 font-mono text-xs uppercase tracking-wide">
                    {span.toolKey}
                  </td>
                  <td className="py-3">{span.agent}</td>
                  <td className="py-3 font-mono text-xs text-slate-300/80">
                    {truncate(span.requestId)}
                  </td>
                  <td className="py-3">{started}</td>
                  <td className="py-3">{span.durationMs.toLocaleString()}</td>
                  <td className="py-3">{span.status ?? "—"}</td>
                  <td
                    className={`py-3 font-semibold ${span.ok ? "text-emerald-300" : "text-rose-300"}`}
                  >
                    {span.ok ? "Success" : "Error"}
                  </td>
                  <td className="py-3 font-mono text-xs">
                    {primaryHash ? truncate(primaryHash) : "—"}
                  </td>
                  <td className="py-3 text-xs text-slate-300/80">
                    {formatTokenCounts(span)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CardGlass>
  );
}

function selectPrimaryHash(span: AiSpanFixture): string | undefined {
  if (span.ok) {
    return span.hashes.response ?? span.hashes.request;
  }
  return span.hashes.error ?? span.hashes.request;
}

function truncate(value: string): string {
  if (value.length <= 12) {
    return value;
  }
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatTokenCounts(span: AiSpanFixture): string {
  const parts: string[] = [];
  if (typeof span.tokenCounts.request === "number") {
    parts.push(`req ${span.tokenCounts.request}`);
  }
  if (typeof span.tokenCounts.response === "number") {
    parts.push(`res ${span.tokenCounts.response}`);
  }
  if (typeof span.tokenCounts.error === "number") {
    parts.push(`err ${span.tokenCounts.error}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}
