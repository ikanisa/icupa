import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

const toneClasses = {
  neutral: "border-white/15 bg-white/10 text-white/80",
  info: "border-sky-400/50 bg-sky-400/15 text-sky-100",
  success: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
  warning: "border-amber-400/50 bg-amber-400/10 text-amber-100",
} as const;

export type BadgeTone = keyof typeof toneClasses;

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ tone = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        toneClasses[tone] ?? toneClasses.neutral,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
