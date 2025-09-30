import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  Bot,
  User,
  Sparkles,
  ClipboardCheck,
  ShieldCheck,
  Boxes,
  Megaphone,
  ChefHat,
} from 'lucide-react';
import type { ComponentType } from 'react';

const AGENT_ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  waiter: ChefHat,
  upsell: Sparkles,
  support: ClipboardCheck,
  compliance: ShieldCheck,
  inventory: Boxes,
  promo: Megaphone,
};

const AGENT_STYLE_MAP: Record<string, string> = {
  waiter: 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/40',
  upsell: 'bg-purple-500/20 text-purple-100 border border-purple-400/40',
  support: 'bg-sky-500/20 text-sky-100 border border-sky-400/40',
  compliance: 'bg-amber-500/20 text-amber-100 border border-amber-400/40',
  inventory: 'bg-orange-500/20 text-orange-100 border border-orange-400/40',
  promo: 'bg-pink-500/20 text-pink-100 border border-pink-400/40',
  admin: 'bg-teal-500/20 text-teal-100 border border-teal-400/40',
  merchant: 'bg-indigo-500/20 text-indigo-100 border border-indigo-400/40',
};

export interface AgentAvatarProps {
  agent?: string | null;
  size?: 'sm' | 'md' | 'lg';
  typing?: boolean;
}

export function AgentAvatar({ agent, size = 'md', typing = false }: AgentAvatarProps) {
  const Icon = agent ? AGENT_ICON_MAP[agent] ?? Bot : Bot;
  const baseClass =
    size === 'sm'
      ? 'h-8 w-8 text-xs'
      : size === 'lg'
      ? 'h-12 w-12 text-lg'
      : 'h-10 w-10 text-sm';

  const style = agent ? AGENT_STYLE_MAP[agent] ?? 'bg-primary/20 text-primary-foreground border border-primary/40' : 'bg-primary/20 text-primary-foreground border border-primary/40';

  return (
    <Avatar className={cn(baseClass, 'border transition-colors', typing && 'animate-pulse')}>
      <AvatarFallback className={cn('font-semibold uppercase', baseClass, style)}>
        <Icon className={cn('h-1/2 w-1/2')} />
      </AvatarFallback>
    </Avatar>
  );
}

export function UserAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const baseClass =
    size === 'sm'
      ? 'h-8 w-8 text-xs'
      : size === 'lg'
      ? 'h-12 w-12 text-lg'
      : 'h-10 w-10 text-sm';

  return (
    <Avatar className={cn(baseClass, 'border bg-white text-primary')}>
      <AvatarFallback className={cn('font-semibold uppercase', baseClass)}>
        <User className={cn('h-1/2 w-1/2')} />
      </AvatarFallback>
    </Avatar>
  );
}
