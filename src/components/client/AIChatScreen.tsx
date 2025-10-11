import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Badge, useToast } from '@/modules/common';
import { z } from 'zod';
import { AgentRunDetailsDialog, ChatComposer, ChatTranscript } from '@/modules/agents-ui';
import { useAgentChat } from '@/modules/agents-ui';
import type { AgentChatMessage, AgentFeedbackRating } from '@/types/agents';
import { parseAgentStreamEvent } from '@/lib/chat-stream';
import { AgentMetadataSchema } from '@/lib/agent-schemas';

interface CartSnapshotItem {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
}

interface AIChatScreenProps {
  tableSessionId?: string | null;
  tenantId?: string | null;
  locationId?: string | null;
  locale?: string;
  allergies?: string[];
  ageVerified?: boolean;
  cartItems?: CartSnapshotItem[];
  onAddToCart?: (item: { id: string; name: string; priceCents: number }) => void;
}

const UpsellSuggestionSchema = z.object({
  item_id: z.string().uuid(),
  name: z.string(),
  price_cents: z.number().int().nonnegative(),
  currency: z.string(),
  rationale: z.string(),
  allergens: z.array(z.string()),
  tags: z.array(z.string()),
  is_alcohol: z.boolean(),
  citations: z.array(z.string()).optional().default([]),
});

const WaiterResponseSchema = z.object({
  session_id: z.string().uuid(),
  reply: z.string(),
  upsell: z.array(UpsellSuggestionSchema).optional().default([]),
  disclaimers: z.array(z.string()).optional().default([]),
  citations: z.array(z.string()).optional().default([]),
  cost_usd: z.number().optional(),
  metadata: AgentMetadataSchema.optional(),
});

const uuidRegex = /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}$/;

function buildWaiterPrompts(options: {
  upsell: z.infer<typeof UpsellSuggestionSchema>[];
  hasAllergies: boolean;
  cartSize: number;
}): string[] {
  const prompts: string[] = [];
  const seen = new Set<string>();

  options.upsell.slice(0, 2).forEach((suggestion) => {
    if (!seen.has(suggestion.name.toLowerCase())) {
      prompts.push(`Tell me more about ${suggestion.name}`);
      seen.add(suggestion.name.toLowerCase());
    }
  });

  if (options.upsell.length > 0) {
    const first = options.upsell[0];
    if (!seen.has(`add-${first.name.toLowerCase()}`)) {
      prompts.push(`Add ${first.name} to my order`);
      seen.add(`add-${first.name.toLowerCase()}`);
    }
  }

  prompts.push(options.cartSize > 0 ? 'Review my current order' : 'Show popular dishes');
  prompts.push(options.hasAllergies ? 'Filter items to avoid my allergens' : "What are today's specials?");

  return Array.from(new Set(prompts)).slice(0, 5);
}

export function AIChatScreen({
  tableSessionId,
  tenantId,
  locationId,
  locale = 'en',
  allergies = [],
  ageVerified = false,
  cartItems = [],
  onAddToCart,
}: AIChatScreenProps) {
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [inspectedMessage, setInspectedMessage] = useState<AgentChatMessage | null>(null);

  const sanitizedAllergies = useMemo(
    () => allergies.map((value) => value.trim()).filter(Boolean),
    [allergies]
  );

  const agentCart = useMemo(
    () =>
      cartItems
        .filter((item) => uuidRegex.test(item.id) && item.quantity > 0)
        .map((item) => ({ item_id: item.id, quantity: item.quantity })),
    [cartItems]
  );

  const basePrompts = useMemo(
    () => [
      "What's popular today?",
      'I have a gluten allergy',
      'Suggest wine pairings',
      "What's the prep time for pasta?",
    ],
    []
  );

  const introMessage = useMemo<AgentChatMessage>(
    () => ({
      id: 'intro',
      role: 'assistant',
      content:
        "Hello! I'm ICUPA, your AI dining assistant. I can help you find dishes, check allergens, and suggest pairings. How can I help?",
      createdAt: new Date(),
      quickReplies: basePrompts,
    }),
    [basePrompts]
  );

  const streamingEnabled = import.meta.env?.VITE_AGENTS_STREAMING === 'true';
  const pollingEnabled = import.meta.env?.VITE_AGENTS_LONG_POLLING === 'true';

  const agentContext = useMemo(
    () => ({
      table_session_id: tableSessionId ?? undefined,
      tenant_id: tenantId ?? undefined,
      location_id: locationId ?? undefined,
      language: locale,
      allergies: sanitizedAllergies.length ? sanitizedAllergies : undefined,
      age_verified: ageVerified,
      cart: agentCart.length ? agentCart : undefined,
    }),
    [tableSessionId, tenantId, locationId, locale, sanitizedAllergies, ageVerified, agentCart]
  );

  const waiterChat = useAgentChat(
    useMemo(
      () => ({
        agent: 'waiter',
        path: '/agents/waiter',
        parseResponse: (data: unknown) => {
          const parsed = WaiterResponseSchema.parse(data);
          return { response: parsed, metadata: parsed.metadata };
        },
        getSessionId: (result: { response: z.infer<typeof WaiterResponseSchema> }) => result.response.session_id,
        mapResponse: (response: z.infer<typeof WaiterResponseSchema>) => ({
          content: response.reply,
          metadata: response.metadata,
          quickReplies:
            response.metadata?.suggested_prompts?.map((prompt) => prompt.prompt) ??
            buildWaiterPrompts({
              upsell: response.upsell,
              hasAllergies: sanitizedAllergies.length > 0,
              cartSize: agentCart.length,
            }),
          extras: {
            disclaimers: response.disclaimers,
            upsell: response.upsell,
            citations: response.citations,
            raw: response,
          },
        }),
        buildPayload: ({ message, sessionId, context }) => ({
          message,
          session_id: sessionId ?? undefined,
          table_session_id: context?.table_session_id,
          tenant_id: context?.tenant_id,
          location_id: context?.location_id,
          language: context?.language,
          allergies: context?.allergies,
          age_verified: context?.age_verified,
          cart: context?.cart,
        }),
        parseStreamEvent: (payload: unknown) => parseAgentStreamEvent(payload, 'waiter'),
        ...(streamingEnabled
          ? {
              streamPath: (sessionId: string) => `/agent-sessions/${sessionId}/stream`,
            }
          : {}),
        ...(pollingEnabled
          ? {
              pollPath: (sessionId: string) => `/agent-sessions/${sessionId}/events`,
              pollIntervalMs: 3500,
            }
          : {}),
      }),
      [agentCart, pollingEnabled, sanitizedAllergies, streamingEnabled]
    )
  );

  const combinedMessages = useMemo(
    () => [introMessage, ...waiterChat.messages],
    [introMessage, waiterChat.messages]
  );

  const availablePrompts = useMemo(() => {
    const set = new Map<string, string>();
    introMessage.quickReplies?.forEach((prompt) => set.set(prompt.toLowerCase(), prompt));
    waiterChat.availablePrompts.forEach((prompt) => set.set(prompt.toLowerCase(), prompt));
    return Array.from(set.values());
  }, [introMessage.quickReplies, waiterChat.availablePrompts]);

  useEffect(() => {
    if (waiterChat.error) {
      toast({
        title: 'AI assistant issue',
        description: waiterChat.error.message,
        variant: 'destructive',
      });
    }
  }, [waiterChat.error, toast]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    waiterChat.sendMessage(trimmed, agentContext);
    setInputValue('');
  };

  const handleFeedback = (message: AgentChatMessage, rating: AgentFeedbackRating) => {
    waiterChat.submitFeedback(message, rating, agentContext);
  };

  const handleUpsellAction = (item: NonNullable<AgentChatMessage['extras']>['upsell'][number]) => {
    if (!onAddToCart) return;
    onAddToCart({ id: item.item_id, name: item.name, priceCents: item.price_cents });
    toast({
      title: `${item.name} added to cart`,
      description: 'Review your cart when you are ready to place the order.',
    });
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <Card className="glass-card flex h-[640px] flex-col border border-white/10 bg-white/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-lg text-white">ICUPA AI Waiter</CardTitle>
            <p className="text-xs text-white/70">Personalised menu guidance and allergen-safe upsells.</p>
          </div>
          <Badge variant="outline" className="border-emerald-400/40 bg-emerald-500/10 text-emerald-100">
            {waiterChat.sessionId ? 'Session active' : 'Ready'}
          </Badge>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <ChatTranscript
            messages={combinedMessages}
            isTyping={waiterChat.isStreaming}
            typingAgent="waiter"
            onInspectMetadata={(message) => {
              setInspectedMessage(message);
              setDetailsOpen(true);
            }}
            onFeedback={handleFeedback}
            feedbackPendingMessageId={waiterChat.feedbackPendingMessageId}
            onUpsellAction={onAddToCart ? handleUpsellAction : undefined}
          />
          <ChatComposer
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSend}
            disabled={waiterChat.isSending}
            suggestions={availablePrompts}
          />
        </CardContent>
      </Card>

      <AgentRunDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        message={inspectedMessage}
      />
    </div>
  );
}
