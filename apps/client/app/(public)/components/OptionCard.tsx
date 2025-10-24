import { CardGlass, buttonClassName } from "@ecotrips/ui";
import type { ReactNode } from "react";

export interface OptionCardProps {
  title: string;
  subtitle?: string;
  chip?: ReactNode;
  actionLabel?: string;
  actionHref?: string;
  actionOnClick?: () => void;
  children?: ReactNode;
  footer?: ReactNode;
}

export function OptionCard({
  title,
  subtitle,
  chip,
  actionLabel,
  actionHref,
  actionOnClick,
  children,
  footer,
}: OptionCardProps) {
  const action = actionLabel
    ? (
      <a
        href={actionHref ?? "#"}
        onClick={actionOnClick}
        className={buttonClassName(actionOnClick ? "secondary" : "glass")}
      >
        {actionLabel}
      </a>
    )
    : null;

  return (
    <CardGlass
      title={
        <span className="flex items-center gap-2">
          <span>{title}</span>
          {chip ? <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/80">{chip}</span> : null}
        </span>
      }
      subtitle={subtitle}
      actions={action}
    >
      <div className="space-y-3 text-sm text-white/80">
        {children}
        {footer ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
            {footer}
          </div>
        ) : null}
      </div>
    </CardGlass>
  );
}

export function CountdownChip({ expiresAt }: { expiresAt: string }) {
  const timeRemaining = computeTimeRemaining(expiresAt);
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-200">
      <span aria-hidden>⏳</span>
      <span>{timeRemaining}</span>
    </span>
  );
}

function computeTimeRemaining(expiresAt: string): string {
  const expires = Date.parse(expiresAt);
  if (Number.isNaN(expires)) {
    return "timer syncing";
  }
  const ms = expires - Date.now();
  if (ms <= 0) {
    return "expired";
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}
