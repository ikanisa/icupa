import { useMemo, useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, Sparkles, AlertCircle, ShoppingCart } from 'lucide-react';
import { z } from 'zod';
import { toast } from '@icupa/ui/use-toast';
import { cn } from '@/lib/utils';

interface CartSnapshotItem {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
}

interface UpsellSuggestion {
  item_id: string;
  name: string;
  price_cents: number;
  currency: string;
  rationale: string;
  allergens: string[];
  tags: string[];
  is_alcohol: boolean;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  quickReplies?: string[];
  upsell?: UpsellSuggestion[];
  disclaimers?: string[];
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

const uuidRegex = /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}$/;

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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content:
        "Hello! I'm ICUPA, your AI dining assistant. I can help you find the perfect dishes, check for allergens, and suggest pairings. What would you like to know?",
      timestamp: new Date(),
      quickReplies: [
        "What's popular today?",
        'I have a gluten allergy',
        'Suggest wine pairings',
        "What's the prep time for pasta?",
      ],
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [agentSessionId, setAgentSessionId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const waiterEndpoint = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_AGENTS_URL?.replace(/\/$/, '');
    if (!base) return null;
    return `${base}/agents/waiter`;
  }, []);

  const AgentResponseSchema = useMemo(
    () =>
      z.object({
        session_id: z.string().uuid(),
        reply: z.string(),
        upsell: z
          .array(
            z.object({
              item_id: z.string().uuid(),
              name: z.string(),
              price_cents: z.number().int().nonnegative(),
              currency: z.string(),
              rationale: z.string(),
              allergens: z.array(z.string()),
              tags: z.array(z.string()),
              is_alcohol: z.boolean(),
            })
          )
          .optional()
          .default([]),
        disclaimers: z.array(z.string()).optional().default([]),
        citations: z.array(z.string()).optional().default([]),
      }),
    []
  );

  const validCartForAgent = useMemo(
    () =>
      cartItems
        .filter((item) => uuidRegex.test(item.id))
        .map((item) => ({ item_id: item.id, quantity: item.quantity })),
    [cartItems]
  );

  const sendMessage = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    if (!waiterEndpoint) {
      toast({
        title: 'AI assistant offline',
        description: 'The ICUPA AI service is not configured. Please ask a team member for help.',
        variant: 'destructive',
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);
    setLastError(null);

    try {
      const response = await fetch(waiterEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: trimmed,
          table_session_id: tableSessionId ?? undefined,
          tenant_id: tenantId ?? undefined,
          location_id: locationId ?? undefined,
          session_id: agentSessionId ?? undefined,
          language: locale,
          allergies: allergies.length ? allergies : undefined,
          age_verified: ageVerified,
          cart: validCartForAgent.length ? validCartForAgent : undefined,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.message ?? `Agent returned ${response.status}`);
      }

      const raw = await response.json();
      const parsed = AgentResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error('Agent response failed schema validation');
      }
      const data = parsed.data;

      setAgentSessionId(data.session_id);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.reply,
        timestamp: new Date(),
        quickReplies:
          data.upsell && data.upsell.length > 0
            ? data.upsell.map((suggestion) => `Add ${suggestion.name}`)
            : undefined,
        upsell: data.upsell ?? [],
        disclaimers: data.disclaimers ?? [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong while contacting ICUPA.';
      setLastError(message);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content:
            "I couldn't reach the ICUPA assistant right now. Please try again shortly or ask a team member for support.",
          timestamp: new Date(),
        },
      ]);
      toast({
        title: 'Assistant unavailable',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };

  const handleUpsellAdd = (suggestion: UpsellSuggestion) => {
    if (!onAddToCart) return;
    onAddToCart({ id: suggestion.item_id, name: suggestion.name, priceCents: suggestion.price_cents });
    toast({
      title: 'Added to cart',
      description: `${suggestion.name} added from ICUPA recommendation.`,
    });
  };

  return (
    <div className="flex-1 flex flex-col p-4 pb-32">
      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4"
      >
        <Card className="glass-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-gradient rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-semibold">ICUPA Assistant</h2>
                <p className="text-sm text-muted-foreground">AI-powered dining companion</p>
              </div>
              <Badge variant="outline" className="ml-auto bg-success/20 text-success border-success/30">
                <Sparkles className="w-3 h-3 mr-1" /> Online
              </Badge>
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground" role="note">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5" aria-hidden="true" />
              <span>
                Responses are generated by AI based on venue policies. Confirm allergen and age-sensitive recommendations with staff when in doubt.
              </span>
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <div
        className="flex-1 space-y-4 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {messages.map((message, index) => (
          <motion.div
            key={message.id}
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: prefersReducedMotion ? 0 : index * 0.1 }}
            className={cn('flex', message.type === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div className={cn('max-w-[80%]', message.type === 'user' ? 'order-2' : 'order-1')}>
              <Card
                className={cn(
                  'glass-card border-0',
                  message.type === 'user' && 'bg-primary-gradient text-primary-foreground'
                )}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    {message.type === 'assistant' && <Bot className="w-4 h-4 mt-0.5 text-primary" />}
                    {message.type === 'user' && <User className="w-4 h-4 mt-0.5 text-primary-foreground" />}
                    <div className="flex-1">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      <p
                        className={cn(
                          'text-xs mt-1',
                          message.type === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        )}
                      >
                        {message.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {message.quickReplies && (
                <motion.div
                  initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: prefersReducedMotion ? 0 : 0.3 }}
                  className="mt-2 flex flex-wrap gap-2"
                >
                  {message.quickReplies.map((suggestion, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="text-xs h-auto py-1.5 px-3 rounded-full bg-background/50 hover:bg-primary/10"
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </motion.div>
              )}

              {message.disclaimers && message.disclaimers.length > 0 && (
                <div className="mt-3 space-y-1">
                  {message.disclaimers.map((note, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground flex gap-2">
                      <AlertCircle className="w-3 h-3 text-amber-300" aria-hidden="true" />
                      <span>{note}</span>
                    </p>
                  ))}
                </div>
              )}

              {message.upsell && message.upsell.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Recommended for you</p>
                  <div className="flex flex-col gap-2">
                    {message.upsell.map((suggestion) => (
                      <div
                        key={suggestion.item_id}
                        className="rounded-2xl border border-border/40 bg-background/40 p-3 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{suggestion.name}</p>
                            <p className="text-xs text-muted-foreground">{suggestion.rationale}</p>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="gap-2"
                            onClick={() => handleUpsellAdd(suggestion)}
                          >
                            <ShoppingCart className="w-4 h-4" /> Add
                          </Button>
                        </div>
                        {suggestion.allergens.length > 0 && (
                          <div className="flex flex-wrap gap-1 text-[11px] text-amber-100">
                            {suggestion.allergens.map((allergen) => (
                              <Badge key={allergen} variant="outline" className="border-amber-300/40">
                                {allergen}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
            role="status"
            aria-live="polite"
          >
            <Card className="glass-card border-0">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  <div className="flex gap-1">
                    <motion.div
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: 0 }}
                      className="w-2 h-2 bg-primary/60 rounded-full"
                    />
                    <motion.div
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: 0.15 }}
                      className="w-2 h-2 bg-primary/60 rounded-full"
                    />
                    <motion.div
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: 0.3 }}
                      className="w-2 h-2 bg-primary/60 rounded-full"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      <div className="mt-6 space-y-2">
        <form onSubmit={handleSubmit} className="glass-card border-0 p-3 rounded-2xl">
          <div className="flex items-center gap-3">
            <label htmlFor="ai-message" className="sr-only">
              Ask ICUPA
            </label>
            <Input
              id="ai-message"
              placeholder="Ask about dishes, allergens, or pairings"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              className="bg-background/60 border-border/40"
              disabled={isTyping}
              autoComplete="off"
            />
            <Button type="submit" size="icon" className="rounded-full" aria-label="Send message" disabled={isTyping}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
        {lastError && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {lastError}
          </p>
        )}
      </div>
    </div>
  );
}
