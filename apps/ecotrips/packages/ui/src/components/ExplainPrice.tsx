import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

import type { PriceBreakdown } from "@ecotrips/types";

const segmentToneClasses: Record<string, string> = {
  emerald: "from-emerald-400/80 to-emerald-500/60",
  sky: "from-sky-400/80 to-sky-500/60",
  amber: "from-amber-400/80 to-amber-500/60",
  rose: "from-rose-400/80 to-rose-500/60",
  lime: "from-lime-400/80 to-lime-500/60",
  indigo: "from-indigo-400/80 to-indigo-500/60",
  slate: "from-slate-400/80 to-slate-500/60",
};

const badgeToneClasses: Record<string, string> = {
  neutral: "bg-white/10 text-white/80 border-white/20",
  info: "bg-sky-500/20 text-sky-100 border-sky-400/30",
  success: "bg-emerald-500/20 text-emerald-100 border-emerald-400/30",
  warning: "bg-amber-500/20 text-amber-100 border-amber-400/30",
  danger: "bg-rose-500/20 text-rose-100 border-rose-400/30",
};

export type ExplainPriceProps = HTMLAttributes<HTMLDivElement> & {
  breakdown: PriceBreakdown;
  headline?: string;
};

export function ExplainPrice({ breakdown, headline, className, ...props }: ExplainPriceProps) {
  const total = breakdown.total_amount_cents > 0
    ? breakdown.total_amount_cents
    : breakdown.segments.reduce((sum, segment) => sum + segment.amount_cents, 0);

  return (
    <section
      className={clsx(
        "space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-white shadow-inner",
        className,
      )}
      {...props}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60">{headline ?? "Price breakdown"}</p>
          {breakdown.updated_at && (
            <p className="text-[11px] text-white/50">Updated {new Date(breakdown.updated_at).toLocaleDateString()}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-white/60">Total</p>
          <p className="text-lg font-semibold text-sky-100">
            {formatCurrency(total, breakdown.currency)}
          </p>
          {typeof breakdown.collected_amount_cents === "number" && (
            <p className="text-xs text-white/60">
              Collected {formatCurrency(breakdown.collected_amount_cents, breakdown.currency)}
            </p>
          )}
        </div>
      </header>

      <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
        {breakdown.segments.map((segment) => {
          const width = total > 0 ? Math.round((segment.amount_cents / total) * 1000) / 10 : 0;
          const tone = segment.tone ?? toneForCategory(segment.category);
          return (
            <div
              key={segment.id}
              className={clsx(
                "h-full min-w-[2px] bg-gradient-to-r",
                segmentToneClasses[tone] ?? segmentToneClasses.emerald,
              )}
              style={{ width: `${Math.max(width, 2)}%` }}
              aria-label={`${segment.label}: ${formatCurrency(segment.amount_cents, breakdown.currency)}`}
            />
          );
        })}
      </div>

      <ul className="space-y-3 text-sm">
        {breakdown.segments.map((segment) => {
          const tone = segment.tone ?? toneForCategory(segment.category);
          const percentage = total > 0 ? (segment.amount_cents / total) * 100 : 0;
          return (
            <li key={segment.id} className="flex items-start justify-between gap-3">
              <div className="max-w-[65%]">
                <p className="font-medium tracking-tight text-white">
                  <span
                    className={clsx(
                      "mr-2 inline-flex h-2 w-2 rounded-full",
                      gradientDotClass(segmentToneClasses[tone] ?? segmentToneClasses.emerald),
                    )}
                    aria-hidden
                  />
                  {segment.label}
                </p>
                {segment.description && (
                  <p className="mt-1 text-xs text-white/60">{segment.description}</p>
                )}
              </div>
              <div className="text-right text-xs text-white/70">
                <p className="text-sm font-semibold text-white">
                  {formatCurrency(segment.amount_cents, breakdown.currency)}
                </p>
                <p>{percentage.toFixed(1)}%</p>
              </div>
            </li>
          );
        })}
      </ul>

      {breakdown.badges.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {breakdown.badges.map((badge) => (
            <span
              key={badge.id}
              className={clsx(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1",
                badgeToneClasses[badge.tone ?? "neutral"] ?? badgeToneClasses.neutral,
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
              <span className="font-medium">{badge.label}</span>
            </span>
          ))}
        </div>
      )}

      {breakdown.notes.length > 0 && (
        <ul className="space-y-1 text-xs text-white/60">
          {breakdown.notes.map((note, index) => (
            <li key={`${note}-${index}`}>• {note}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatCurrency(amountCents: number, currency: string) {
  const amount = amountCents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (_error) {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function toneForCategory(category?: string) {
  switch (category) {
    case "tax":
      return "sky";
    case "fee":
      return "amber";
    case "sustainability":
      return "lime";
    case "discount":
      return "rose";
    case "insurance":
      return "indigo";
    case "other":
      return "slate";
    default:
      return "emerald";
  }
}

function gradientDotClass(gradient: string) {
  const [from] = gradient.split(" ");
  if (!from?.startsWith("from-")) return "bg-white/70";
  return from.replace("from-", "bg-");
}
