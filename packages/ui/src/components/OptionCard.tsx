import { clsx } from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

export interface OptionCardMeta {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
}

export interface OptionCardProps extends HTMLAttributes<HTMLDivElement> {
  title: ReactNode;
  subtitle?: ReactNode;
  price?: ReactNode;
  priceCaption?: ReactNode;
  meta?: OptionCardMeta[];
  highlights?: ReactNode[];
  actions?: ReactNode;
  status?: ReactNode;
}

export function OptionCard({
  title,
  subtitle,
  price,
  priceCaption,
  meta,
  highlights,
  actions,
  status,
  className,
  children,
  ...props
}: OptionCardProps) {
  return (
    <section
      className={clsx(
        "relative overflow-hidden rounded-3xl border border-[var(--eco-glass-border)] bg-[var(--eco-glass-bg)] p-5 text-white shadow-[var(--eco-glass-shadow)] backdrop-blur-[var(--eco-glass-blur)]",
        className,
      )}
      {...props}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold tracking-tight text-white">{title}</h3>
          {subtitle && <p className="text-sm text-slate-200/80">{subtitle}</p>}
        </div>
        {(price || priceCaption) && (
          <div className="text-right">
            {price && <div className="text-xl font-semibold text-sky-200">{price}</div>}
            {priceCaption && (
              <div className="text-xs uppercase tracking-[0.3em] text-slate-300/70">
                {priceCaption}
              </div>
            )}
          </div>
        )}
      </header>

      {meta && meta.length > 0 && (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {meta.map((entry, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            >
              {entry.icon && (
                <span className="text-lg" aria-hidden="true">
                  {entry.icon}
                </span>
              )}
              <div>
                <dt className="text-xs uppercase tracking-[0.25em] text-slate-300/70">
                  {entry.label}
                </dt>
                <dd className="mt-1 text-sm font-medium text-white/90">{entry.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      )}

      {highlights && highlights.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm text-slate-100/90">
          {highlights.map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <span aria-hidden className="mt-[3px] h-1.5 w-1.5 rounded-full bg-sky-300" />
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      )}

      {children && <div className="mt-4 space-y-3 text-sm text-slate-100/90">{children}</div>}

      {status && <div className="mt-4 text-xs text-emerald-200/80">{status}</div>}

      {actions && (
        <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-100/90">{actions}</div>
      )}
    </section>
  );
}
