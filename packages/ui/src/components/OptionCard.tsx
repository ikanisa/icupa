"use client";

import { useEffect, useMemo, useState } from "react";

import { buttonClassName } from "../styles/button";

export type OptionCardRiskLevel = "low" | "medium" | "high";

export type OptionCardHighlight = {
  text: string;
  risk?: OptionCardRiskLevel;
};

export type OptionCardProps = {
  title: string;
  description?: string;
  meta?: string;
  riskLevel?: OptionCardRiskLevel;
  highlights?: OptionCardHighlight[];
  actions?: string[];
  triggerLabel?: string;
  modalTitle?: string;
};

const riskStyles: Record<OptionCardRiskLevel, string> = {
  low: "bg-emerald-500/20 text-emerald-200 border-emerald-400/60",
  medium: "bg-amber-500/20 text-amber-200 border-amber-400/60",
  high: "bg-rose-500/20 text-rose-200 border-rose-400/60",
};

export function OptionCard({
  title,
  description,
  meta,
  riskLevel = "low",
  highlights = [],
  actions = [],
  triggerLabel = "View details",
  modalTitle,
}: OptionCardProps) {
  const [open, setOpen] = useState(false);
  const badgeClassName = useMemo(() => riskStyles[riskLevel] ?? riskStyles.low, [riskLevel]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/20 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-semibold text-white">{title}</h4>
            {description ? <p className="mt-1 text-sm text-white/70">{description}</p> : null}
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${badgeClassName}`}>
            {riskLevel} risk
          </span>
        </div>
        {meta ? <p className="mt-3 text-xs uppercase tracking-wide text-white/40">{meta}</p> : null}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className={buttonClassName("ghost")} onClick={() => setOpen(true)}>
            {triggerLabel}
          </button>
        </div>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${badgeClassName}`}>
                  {riskLevel} risk
                </p>
                <h3 className="mt-3 text-lg font-semibold text-white">{modalTitle ?? title}</h3>
              </div>
              <button type="button" className={buttonClassName("ghost")} onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <div className="mt-5 space-y-4 text-sm text-white/80">
              {description ? <p>{description}</p> : null}
              {highlights.length > 0 ? (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-white/60">Highlights</h4>
                  <ul className="mt-2 space-y-2">
                    {highlights.map((item, index) => (
                      <li key={`${item.text}-${index}`} className="flex items-start gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full bg-white/50" />
                        <div>
                          <p className="text-white/90">{item.text}</p>
                          {item.risk ? (
                            <p className="text-xs uppercase tracking-wide text-white/40">{item.risk} risk</p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {actions.length > 0 ? (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-white/60">Suggested actions</h4>
                  <ul className="mt-2 space-y-2 list-disc pl-5">
                    {actions.map((action, index) => (
                      <li key={`${action}-${index}`}>{action}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
