export const themeTokens = {
  gradient: {
    aurora: 'bg-[radial-gradient(circle_at_top,_rgba(255,94,247,0.22),_rgba(86,159,255,0.12))]',
  },
  glass: {
    card:
      'glass-card border border-white/10 bg-[color:rgba(15,23,42,0.55)] backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.35)]',
  },
} as const;

export const classNames = {
  glassCard: themeTokens.glass.card,
};
