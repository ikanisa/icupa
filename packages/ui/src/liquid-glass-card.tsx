'use client';

import { motion } from 'framer-motion';
import type { HTMLAttributes } from 'react';
import { cn } from './lib/utils';

interface LiquidGlassCardProps extends HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
}

export function LiquidGlassCard({ className, shimmer = true, children, ...props }: LiquidGlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 18 }}
      className={cn(
        'glass-card relative overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-6 text-white shadow-xl',
        className
      )}
      {...props}
    >
      {shimmer ? (
        <span className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_45%)]" />
      ) : null}
      {children}
    </motion.div>
  );
}

export default LiquidGlassCard;
