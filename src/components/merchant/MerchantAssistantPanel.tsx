import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { z } from 'zod';
import {
  AgentRunDetailsDialog,
  ChatComposer,
  ChatTranscript,
} from '@/components/ai';
import { useAgentChat } from '@/hooks/useAgentChat';
import type { AgentChatMessage, AgentFeedbackRating } from '@/types/agents';
import { parseAgentStreamEvent } from '@/lib/chat-stream';
import { AgentMetadataSchema } from '@/lib/agent-schemas';
import type { MerchantLocation } from '@/hooks/useMerchantLocations';

const InventoryResponseSchema = z.object({
  session_id: z.string().uuid(),
  directives: z
    .array(
      z.object({
        inventory_id: z.string().uuid(),
        new_quantity: z.number().nonnegative(),
        auto_86: z.boolean().optional(),
        rationale: z.string(),
      })
    )
    .optional()
    .default([]),
  alerts: z.array(z.string()).optional().default([]),
  cost_usd: z.number().optional(),
  metadata: AgentMetadataSchema.optional(),
});

const SupportResponseSchema = z.object({
  session_id: z.string().uuid(),
  summary: z.string(),
  ticket: z.object({
    id: z.string().uuid(),
    priority: z.enum(['low', 'medium', 'high']),
    recommended_channel: z.enum(['email', 'sms', 'push', 'phone']),
  }),
  next_steps: z.array(z.string()).optional().default([]),
  cost_usd: z.number().optional(),
  metadata: AgentMetadataSchema.optional(),
});

const PromoResponseSchema = z.object({
  session_id: z.string().uuid(),
  actions: z
    .array(
      z.object({
        campaign_id: z.string().uuid(),
        action: z.enum(['activate', 'pause', 'archive', 'adjust_budget']),
        rationale: z.string(),
        budget_delta_cents: z.number().optional().nullable(),
      })
    )
    .optional()
    .default([]),
  notes: z.array(z.string()).optional().default([]),
  cost_usd: z.number().optional(),
  metadata: AgentMetadataSchema.optional(),
});

type MerchantAgent = 'inventory' | 'support' | 'promo';
type InventoryDirective = NonNullable<z.infer<typeof InventoryResponseSchema>['directives']>[number];
type PromoAction = NonNullable<z.infer<typeof PromoResponseSchema>['actions']>[number];

type AgentConfig<TSchema extends z.ZodTypeAny> = {
  schema: TSchema;
  path: string;
  intro: string;
  prompts: string[];
  mapResponse: (
    response: z.infer<TSchema>
  ) => Omit<AgentChatMessage, 'id' | 'role' | 'createdAt'>;
};

const MERCHANT_AGENT_CONFIGS: Record<MerchantAgent, AgentConfig<any>> = {
  inventory: {
    schema: InventoryResponseSchema,
    path: '/agents/inventory',
    intro:
      'Inventory steward standing by. Ask for low-stock callouts, auto-86 suggestions, or substitution ideas.',
    prompts: [
      'Which items are low right now?',
      'Draft an 86 alert for staff',
      'Suggest substitutions for 86 items',
    ],
    mapResponse: (response) => {
      const directives = (response.directives ?? []).map((directive: InventoryDirective, index: number) => {
        const quantity = directive.new_quantity;
        const auto86 = directive.auto_86 ? ' (auto-86)' : '';
        return `${index + 1}. Set inventory ${directive.inventory_id} to ${quantity}${auto86}. ${directive.rationale}`;
      });

      const alerts = response.alerts ?? [];
      const contentParts = [] as string[];
      if (directives.length) {
        contentParts.push(`Inventory directives:\n${directives.join('\n')}`);
      } else {
        contentParts.push('No inventory adjustments recommended right now.');
      }
      if (alerts.length) {
        contentParts.push(`Alerts:\n- ${alerts.join('\n- ')}`);
      }

      return {
        content: contentParts.join('\n\n'),
        metadata: response.metadata,
        quickReplies: [
          'Show items at risk of 86',
          'Draft prep guidance for kitchen',
          'Export inventory summary',
        ],
        extras: {
          disclaimers: alerts,
          raw: response,
        },
      } satisfies Omit<AgentChatMessage, 'id' | 'role' | 'createdAt'>;
    },
  },
  support: {
    schema: SupportResponseSchema,
    path: '/agents/support',
    intro: 'Support concierge logging frontline issues. Ask for triage, escalations, or comms templates.',
    prompts: [
      'Prioritize late orders at table 14',
      'Draft a follow-up SMS to the guest',
      'Show unresolved support tickets',
    ],
    mapResponse: (response) => {
      const nextSteps = response.next_steps?.length
        ? `\nNext steps:\n- ${response.next_steps.join('\n- ')}`
        : '';

      return {
        content: `Ticket ${response.ticket.id} (${response.ticket.priority} priority via ${response.ticket.recommended_channel})\n\n${response.summary}${nextSteps}`,
        metadata: response.metadata,
        quickReplies: [
          'Escalate this issue to a manager',
          'Send a make-good offer',
          'Summarize open tickets',
        ],
        extras: {
          raw: response,
        },
      } satisfies Omit<AgentChatMessage, 'id' | 'role' | 'createdAt'>;
    },
  },
  promo: {
    schema: PromoResponseSchema,
    path: '/agents/promo',
    intro: 'Promo strategist ready to optimize campaigns. Request budget tweaks, pauses, or performance recaps.',
    prompts: [
      'How are happy-hour promos performing?',
      'Recommend a budget adjustment',
      'Pause underperforming campaigns',
    ],
    mapResponse: (response) => {
      const actions = (response.actions ?? []).map((action: PromoAction, index: number) => {
        const budget = typeof action.budget_delta_cents === 'number'
          ? ` (budget delta ${(action.budget_delta_cents / 100).toFixed(2)} USD)`
          : '';
        return `${index + 1}. ${action.action.toUpperCase()} campaign ${action.campaign_id}${budget} — ${action.rationale}`;
      });

      const notes = response.notes?.length ? `\nNotes:\n- ${response.notes.join('\n- ')}` : '';
      const content = actions.length
        ? `Promotion actions:\n${actions.join('\n')}${notes}`
        : `No promo adjustments recommended.${notes}`;

      return {
        content,
        metadata: response.metadata,
        quickReplies: [
          'Show campaign ROI',
          'Draft a new promo idea',
          'Evaluate loyalty offer performance',
        ],
        extras: {
          raw: response,
        },
      } satisfies Omit<AgentChatMessage, 'id' | 'role' | 'createdAt'>;
    },
  },
};

export interface MerchantAssistantPanelProps {
  location: MerchantLocation | null;
}

export function MerchantAssistantPanel({ location }: MerchantAssistantPanelProps) {
  const [activeAgent, setActiveAgent] = useState<MerchantAgent>('inventory');
  const [inputValue, setInputValue] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [inspectedMessage, setInspectedMessage] = useState<AgentChatMessage | null>(null);

  const streamingEnabled = import.meta.env?.VITE_AGENTS_STREAMING === 'true';
  const pollingEnabled = import.meta.env?.VITE_AGENTS_LONG_POLLING === 'true';

  const agentConfig = MERCHANT_AGENT_CONFIGS[activeAgent];

  const agentContext = useMemo(
    () => ({
      tenant_id: location?.tenantId,
      location_id: location?.id,
    }),
    [location?.id, location?.tenantId]
  );

  const agentOptions = useMemo(
    () =>
      (Object.keys(MERCHANT_AGENT_CONFIGS) as MerchantAgent[]).map((key) => ({
        id: key,
        label: key === 'inventory' ? 'Inventory' : key === 'support' ? 'Support' : 'Promos',
        subtitle: MERCHANT_AGENT_CONFIGS[key].intro,
      })),
    []
  );

  const chat = useAgentChat(
    useMemo(
      () => ({
        agent: activeAgent,
        path: agentConfig.path,
        parseResponse: (data: unknown) => {
          const parsed = agentConfig.schema.parse(data);
          return { response: parsed, metadata: parsed.metadata };
        },
        getSessionId: (result: { response: any }) => result.response.session_id,
        mapResponse: agentConfig.mapResponse,
        buildPayload: ({ message, sessionId, context }) => ({
          message,
          session_id: sessionId ?? undefined,
          tenant_id: context?.tenant_id,
          location_id: context?.location_id,
        }),
        parseStreamEvent: (payload: unknown) => parseAgentStreamEvent(payload, activeAgent),
        ...(streamingEnabled
          ? {
              streamPath: (sessionId: string) => `/agent-sessions/${sessionId}/stream`,
            }
          : {}),
        ...(pollingEnabled
          ? {
              pollPath: (sessionId: string) => `/agent-sessions/${sessionId}/events`,
              pollIntervalMs: 4000,
            }
          : {}),
      }),
      [activeAgent, agentConfig, pollingEnabled, streamingEnabled]
    )
  );

  const {
    messages,
    isStreaming,
    isSending,
    error,
    availablePrompts,
    sessionId,
    reset,
    sendMessage,
    submitFeedback,
    feedbackPendingMessageId,
  } = chat;

  useEffect(() => {
    reset();
    setInputValue('');
  }, [activeAgent, reset]);

  useEffect(() => {
    if (error) {
      toast({
        title: 'AI assistant issue',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [error]);

  const introMessage = useMemo<AgentChatMessage>(
    () => ({
      id: `intro-${activeAgent}`,
      role: 'assistant',
      content: agentConfig.intro,
      createdAt: new Date(),
      quickReplies: [...agentConfig.prompts],
    }),
    [activeAgent, agentConfig]
  );

  const combinedMessages = useMemo(
    () => [introMessage, ...messages],
    [introMessage, messages]
  );

  const prompts = useMemo(() => {
    const unique = new Map<string, string>();
    agentConfig.prompts.forEach((prompt) => unique.set(prompt.toLowerCase(), prompt));
    availablePrompts.forEach((prompt) => unique.set(prompt.toLowerCase(), prompt));
    return Array.from(unique.values());
  }, [agentConfig.prompts, availablePrompts]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    sendMessage(trimmed, agentContext);
    setInputValue('');
  };

  const handleFeedback = (message: AgentChatMessage, rating: AgentFeedbackRating) => {
    submitFeedback(message, rating, agentContext);
  };

  if (!location) {
    return (
      <Card className="glass-card border border-white/10 bg-white/5 p-6 text-white/70">
        <p>Select a location to reach your AI assistant.</p>
      </Card>
    );
  }

  return (
    <Card className="glass-card flex h-[640px] flex-col border border-white/10 bg-white/5">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg text-white">Service Copilot</CardTitle>
            <p className="text-xs text-white/60">Ask ICUPA to unblock ops, inventory, or promos for {location.name}.</p>
          </div>
          <Badge variant="outline" className="border-white/20 bg-white/10 text-white/70">
            {sessionId ? 'Session active' : 'Ready'}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {agentOptions.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant={option.id === activeAgent ? 'gradient' : 'ghost'}
              size="sm"
              className="rounded-full px-4 text-xs"
              onClick={() => setActiveAgent(option.id as MerchantAgent)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <Separator className="bg-white/10" />
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <ChatTranscript
          messages={combinedMessages}
          isTyping={isStreaming}
          typingAgent={activeAgent}
          onInspectMetadata={(message) => {
            setInspectedMessage(message);
            setDetailsOpen(true);
          }}
          onFeedback={handleFeedback}
          feedbackPendingMessageId={feedbackPendingMessageId}
        />
        <ChatComposer
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSend}
          disabled={isSending}
          suggestions={prompts}
        />
      </CardContent>
      <AgentRunDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        message={inspectedMessage}
      />
    </Card>
  );
}
