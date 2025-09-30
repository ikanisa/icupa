import { AgentAvatar } from '@/components/ai/AgentAvatar';
import { cn } from '@/lib/utils';

export interface ChatTypingIndicatorProps {
  agent?: string | null;
}

export function ChatTypingIndicator({ agent }: ChatTypingIndicatorProps) {
  return (
    <div className="flex w-full items-end gap-3 text-left">
      <AgentAvatar agent={agent ?? undefined} typing size="sm" />
      <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
        <span className="h-2 w-2 animate-bounce rounded-full bg-white/70" style={{ animationDelay: '0ms' }} />
        <span className="h-2 w-2 animate-bounce rounded-full bg-white/55" style={{ animationDelay: '120ms' }} />
        <span className="h-2 w-2 animate-bounce rounded-full bg-white/40" style={{ animationDelay: '240ms' }} />
      </div>
    </div>
  );
}
