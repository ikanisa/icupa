import { AgentAvatar, UserAvatar } from '@/components/ai/AgentAvatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { AgentChatMessage, AgentFeedbackRating } from '@/types/agents';
import { Info, ThumbsUp, ThumbsDown, Loader2, ShoppingCart } from 'lucide-react';
import { useMemo } from 'react';

export interface ChatMessageBubbleProps {
  message: AgentChatMessage;
  onInspectMetadata?: (message: AgentChatMessage) => void;
  onFeedback?: (message: AgentChatMessage, rating: AgentFeedbackRating) => void;
  feedbackPending?: boolean;
  onUpsellAction?: (item: NonNullable<AgentChatMessage['extras']>['upsell'][number]) => void;
}

function formatPrice(priceCents: number, currency: string) {
  const amount = priceCents / 100;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function summariseCost(metadata?: AgentChatMessage['metadata']): string | null {
  if (!metadata?.runs?.length) return null;
  const total = metadata.runs.reduce((sum, run) => sum + (run.cost_usd ?? 0), 0);
  if (!total) return null;
  if (total < 0.01) return '<$0.01';
  return `$${total.toFixed(2)}`;
}

function summariseLatency(latencyMs?: number): string | null {
  if (typeof latencyMs !== 'number' || Number.isNaN(latencyMs)) return null;
  if (latencyMs < 1000) {
    return `${latencyMs}ms`;
  }
  return `${(latencyMs / 1000).toFixed(1)}s`;
}

export function ChatMessageBubble({
  message,
  onInspectMetadata,
  onFeedback,
  feedbackPending = false,
  onUpsellAction,
}: ChatMessageBubbleProps) {
  const isUser = message.role === 'user';
  const primaryAgent = message.primaryAgentType ?? message.metadata?.runs?.[0]?.agent_type ?? null;
  const costSummary = useMemo(() => summariseCost(message.metadata), [message.metadata]);
  const latencySummary = summariseLatency(message.latencyMs);
  const infoParts = useMemo(() => {
    const parts: string[] = [];
    if (latencySummary) parts.push(`Latency ${latencySummary}`);
    if (costSummary) parts.push(`Cost ${costSummary}`);
    return parts;
  }, [costSummary, latencySummary]);

  return (
    <div
      className={cn('flex w-full gap-3', isUser ? 'justify-end text-right' : 'justify-start text-left')}
      data-testid={isUser ? 'agent-message-user' : 'agent-message-assistant'}
      data-agent-type={primaryAgent ?? undefined}
    >
      {!isUser && <AgentAvatar agent={primaryAgent ?? undefined} typing={Boolean(message.metadata && !message.content)} />}

      <div className={cn('flex max-w-[75%] flex-col gap-3', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-3xl px-4 py-3 text-sm shadow-lg backdrop-blur-sm',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-white/10 text-white border border-white/10'
          )}
        >
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          {infoParts.length > 0 && (
            <div className={cn('mt-3 flex items-center gap-3 text-xs', isUser ? 'text-primary-foreground/80' : 'text-white/70')}>
              <Info className="h-3.5 w-3.5" />
              <span>{infoParts.join(' • ')}</span>
            </div>
          )}
        </div>

        {!isUser && message.extras?.upsell && message.extras.upsell.length > 0 && (
          <div className="grid gap-2">
            {message.extras.upsell.map((item) => (
              <Card
                key={item.item_id}
                className="glass-card border border-white/10 bg-black/40 px-4 py-3 text-left text-white/90"
              >
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>{item.name}</span>
                  <span className="text-white/70">{formatPrice(item.price_cents, item.currency)}</span>
                </div>
                <p className="mt-1 text-xs text-white/60">{item.rationale}</p>
                {item.allergens.length > 0 && (
                  <p className="mt-2 text-[11px] uppercase tracking-wide text-amber-300/80">
                    Allergens: {item.allergens.join(', ')}
                  </p>
                )}
                {onUpsellAction && (
                  <Button
                    type="button"
                    variant="glass"
                    size="sm"
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/20 text-xs text-white/90 hover:bg-white/15"
                    onClick={() => onUpsellAction(item)}
                    data-testid="agent-upsell-add"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Add to order
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}

        {!isUser && message.extras?.disclaimers && message.extras.disclaimers.length > 0 && (
          <div className="space-y-1 text-xs text-amber-200/90">
            {message.extras.disclaimers.map((disclaimer) => (
              <p key={disclaimer} className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-3 py-2">
                {disclaimer}
              </p>
            ))}
          </div>
        )}

        {!isUser && message.metadata && onInspectMetadata && (
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-full border border-white/10 bg-white/5 px-3 text-white/80 hover:bg-white/10"
              onClick={() => onInspectMetadata(message)}
            >
              View run details
            </Button>
          </div>
        )}

        {!isUser && onFeedback && (
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span>Was this helpful?</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
                message.feedback === 'up' && 'bg-emerald-500/20 text-emerald-100 border-emerald-400/60'
              )}
              disabled={feedbackPending}
              onClick={() => onFeedback(message, 'up')}
              aria-label="Thumbs up feedback"
              data-testid="agent-feedback-up"
            >
              {feedbackPending && message.feedback !== 'up' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ThumbsUp className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
                message.feedback === 'down' && 'bg-rose-500/20 text-rose-100 border-rose-400/60'
              )}
              disabled={feedbackPending}
              onClick={() => onFeedback(message, 'down')}
              aria-label="Thumbs down feedback"
              data-testid="agent-feedback-down"
            >
              {feedbackPending && message.feedback !== 'down' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ThumbsDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>

      {isUser && <UserAvatar />}
    </div>
  );
}
