export const themeTokens = {
  gradient: {
    aurora:
      "bg-[radial-gradient(circle_at_top,_rgba(255,94,247,0.22),_rgba(86,159,255,0.12))]",
  },
  surfaces: {
    aurora:
      "min-h-screen w-full bg-background/80 text-foreground backdrop-blur-xl",
    neutral: "min-h-screen w-full bg-background text-foreground",
  },
  layout: {
    default: "mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8",
    narrow: "mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8",
    wide: "mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8",
  },
  glass: {
    card:
      "glass-card border border-white/10 bg-[color:rgba(15,23,42,0.55)] backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.35)]",
  },
  text: {
    subdued: "text-muted-foreground",
  },
} as const;

export const classNames = {
  glassCard: themeTokens.glass.card,
  pageAurora: `${themeTokens.surfaces.aurora} ${themeTokens.gradient.aurora}`,
  pageNeutral: themeTokens.surfaces.neutral,
};
