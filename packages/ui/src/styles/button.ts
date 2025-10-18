import { clsx } from "clsx";

export type ButtonVariant = "primary" | "secondary" | "glass";

const baseStyles = "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "text-slate-950 bg-[var(--eco-gradient-primary)] bg-[length:200%] bg-left hover:bg-right shadow-lg shadow-sky-500/30",
  secondary: "text-white bg-slate-800/70 hover:bg-slate-700/80 border border-white/20 backdrop-blur",
  glass: "text-white bg-[var(--eco-glass-bg)] border border-[var(--eco-glass-border)] backdrop-blur-[var(--eco-glass-blur)] shadow-[var(--eco-glass-shadow)]",
};

export function buttonClassName(variant: ButtonVariant = "primary", fullWidth = false, extra?: string) {
  return clsx(baseStyles, variantStyles[variant], fullWidth && "w-full", extra);
}
