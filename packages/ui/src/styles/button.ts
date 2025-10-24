import { clsx } from "clsx";

export type ButtonVariant = "primary" | "secondary" | "glass";

const baseStyles =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-[var(--eco-duration-base)] ease-[var(--eco-easing-std)]";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "text-brand-foreground bg-eco-gradient-primary bg-[length:200%] bg-left hover:bg-right shadow-lg shadow-sky-500/30",
  secondary:
    "text-surface-foreground/95 bg-surface/70 hover:bg-surface/60 border border-white/20 backdrop-blur",
  glass:
    "text-white bg-glass border border-glass-border backdrop-blur-glass shadow-[var(--eco-glass-shadow)]",
};

export function buttonClassName(variant: ButtonVariant = "primary", fullWidth = false, extra?: string) {
  return clsx(baseStyles, variantStyles[variant], fullWidth && "w-full", extra);
}
