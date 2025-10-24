import { clsx } from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

type CardGlassProps = HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

export function CardGlass({
  title,
  subtitle,
  actions,
  className,
  children,
  ...props
}: CardGlassProps) {
  return (
    <section
      className={clsx(
        "relative overflow-hidden rounded-3xl border border-glass-border bg-glass p-5 text-surface-foreground shadow-[var(--eco-glass-shadow)] backdrop-blur-glass",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          {title && <h2 className="text-lg font-semibold tracking-tight text-brand-foreground/90">{title}</h2>}
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div className="mt-4 space-y-3 text-sm text-surface-foreground/90">{children}</div>
    </section>
  );
}
