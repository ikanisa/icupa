"use client";

import { useEffect, useMemo, useState } from "react";
import { ConciergeDailyBrief } from "@ecotrips/types";
import { buttonClassName } from "@ecotrips/ui";

interface ConciergeDailyBriefsProps {
  briefs: ConciergeDailyBrief[];
  timezone?: string;
  offline: boolean;
}

export function ConciergeDailyBriefs({ briefs, timezone, offline }: ConciergeDailyBriefsProps) {
  const [selected, setSelected] = useState<ConciergeDailyBrief | null>(null);

  const headline = offline
    ? "Serving fixture daily briefs while Supabase auth is offline."
    : "ConciergeGuide scheduled the next Wallet briefs.";

  if (briefs.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        {offline
          ? "Fixtures unavailable — ConciergeGuide will populate briefs once connectivity is restored."
          : "No concierge briefs yet. ConciergeGuide publishes the next day by 18:00."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/70">{headline}</p>
      <ul className="space-y-3">
        {briefs.map((brief) => (
          <li
            key={`${brief.day}-${brief.date}`}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="text-xs uppercase tracking-wide text-white/50">
                Day {brief.day} · {formatDate(brief.date, timezone)}
              </p>
              <p className="text-base font-semibold text-white">{brief.headline}</p>
              <p className="text-sm text-white/70">{brief.summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonClassName("glass")}
                onClick={() => setSelected(brief)}
              >
                Open brief
              </button>
            </div>
          </li>
        ))}
      </ul>
      {selected && (
        <BriefModal brief={selected} timezone={timezone} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

interface BriefModalProps {
  brief: ConciergeDailyBrief;
  timezone?: string;
  onClose: () => void;
}

function BriefModal({ brief, timezone, onClose }: BriefModalProps) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const shareText = useMemo(() => {
    const lines = [
      `Day ${brief.day}: ${brief.headline}`,
      ...brief.segments.map((segment) => `• ${segment.time_window} ${segment.title}`),
    ];
    if (brief.group_savings?.nudge_copy) {
      lines.push(`Group savings: ${brief.group_savings.nudge_copy}`);
    }
    return lines.join("\n");
  }, [brief]);

  const shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  const progress = computeSavingsProgress(brief);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Concierge brief for day ${brief.day}`}
    >
      <div className="w-full max-w-2xl rounded-3xl border border-white/15 bg-slate-950/95 p-6 text-white shadow-2xl">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/50">
              Day {brief.day} · {formatDate(brief.date, timezone)}
            </p>
            <h3 className="text-2xl font-semibold">{brief.headline}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="self-start rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 hover:text-white"
          >
            Close
          </button>
        </div>
        <p className="mt-3 text-sm text-white/70">{brief.summary}</p>
        <div className="mt-4 space-y-3">
          {brief.segments.map((segment) => (
            <div key={segment.id} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 text-sm text-white/80">
              <p className="text-xs uppercase tracking-wide text-white/50">{segment.time_window}</p>
              <p className="text-base font-semibold text-white">{segment.title}</p>
              <p className="mt-1 whitespace-pre-line">{segment.instruction}</p>
              {segment.contact && (
                <p className="mt-2 text-xs text-white/60">
                  Contact: {segment.contact.name}
                  {segment.contact.role ? ` · ${segment.contact.role}` : ""}
                  {segment.contact.phone ? ` · ${segment.contact.phone}` : ""}
                </p>
              )}
              {segment.notes && segment.notes.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-white/60">
                  {segment.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
              {segment.safety_note && (
                <p className="mt-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                  Safety: {segment.safety_note}
                </p>
              )}
              {segment.map_link && (
                <a
                  href={segment.map_link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center text-xs text-sky-300 underline"
                >
                  Open map directions
                </a>
              )}
            </div>
          ))}
        </div>
        {brief.alerts.length > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Alerts</p>
            <ul className="mt-2 space-y-2">
              {brief.alerts.map((alert) => (
                <li key={alert.id} className="rounded-xl border border-amber-300/40 bg-amber-300/10 p-3">
                  <p className="text-xs uppercase tracking-wide text-amber-300">{alert.type}</p>
                  <p className="text-sm font-medium">{alert.message}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {brief.group_savings && (
          <div className="mt-4 rounded-2xl border border-sky-400/30 bg-sky-400/10 p-4 text-sm text-sky-50">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-200">Group savings nudge</p>
            <p className="mt-1 text-sm text-sky-50">{brief.group_savings.nudge_copy}</p>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-sky-100">
                <span>
                  {formatCurrency(brief.group_savings.collected_cents)} collected
                </span>
                <span>Goal {formatCurrency(brief.group_savings.target_cents)}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-700">
                <div
                  className="h-2 rounded-full bg-sky-400"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-sky-100">
                {progress}% funded · due {formatDate(brief.group_savings.due_date, timezone)}
              </p>
              {brief.group_savings.next_step && (
                <p className="mt-1 text-xs text-sky-100/80">Next step: {brief.group_savings.next_step}</p>
              )}
            </div>
          </div>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className={buttonClassName("secondary")}
            onClick={onClose}
          >
            Dismiss
          </button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonClassName("glass")}
          >
            Share to WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

function formatDate(input: string, timezone?: string) {
  try {
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return input;
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      timeZone: timezone ?? "UTC",
    }).format(date);
  } catch (_error) {
    return input;
  }
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return "RWF 0";
  return `RWF ${Math.round(value).toLocaleString("en-US")}`;
}

function computeSavingsProgress(brief: ConciergeDailyBrief) {
  const goal = brief.group_savings?.target_cents ?? 0;
  const collected = brief.group_savings?.collected_cents ?? 0;
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((collected / goal) * 100));
}
