import { useMemo, useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Send, Bot, User, Sparkles, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/components/ui/use-toast";
import type { MenuDataSource } from "@/hooks/useMenuData";
import { cartToAgentPayload, callWaiterAgent, type UpsellSuggestion } from "@/lib/agents";
import { markRecommendationAccepted } from "@/lib/recommendations";
import { useCartStore } from "@/stores/cart-store";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggestions?: string[];
  disclaimers?: string[];
  citations?: string[];
  upsell?: UpsellSuggestion[];
  costUsd?: number;
}

interface AIChatScreenProps {
  tableSessionId?: string | null;
  locationId?: string | null;
  menuSource: MenuDataSource;
  cartItems: { id: string; quantity: number }[];
  allergies: string[];
  language?: string | null;
  ageVerified?: boolean;
}

function formatCurrency(amountCents: number, currencyCode: string, locale?: string) {
  const value = amountCents / 100;
  try {
    return new Intl.NumberFormat(locale ?? "en", {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "symbol",
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currencyCode}`.trim();
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function AIChatScreen({
  tableSessionId,
  locationId,
  menuSource,
  cartItems,
  allergies,
  language,
  ageVerified,
}: AIChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "intro",
      type: "assistant",
      content:
        "Hello! I'm ICUPA, your AI dining assistant. I can help you find dishes, check allergens, and suggest perfect pairings.",
      timestamp: new Date(),
      suggestions: [
        "What's popular today?",
        "I have a gluten allergy",
        "Suggest wine pairings",
        "What's the prep time for pasta?",
      ],
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [acceptedImpressions, setAcceptedImpressions] = useState<Set<string>>(() => new Set());
  const prefersReducedMotion = useReducedMotion();
  const addCartItem = useCartStore((state) => state.addItem);

  const agentCartPayload = useMemo(
    () => cartToAgentPayload(cartItems),
    [cartItems]
  );

  const isAgentReady =
    menuSource === "supabase" &&
    (Boolean(tableSessionId) || (Boolean(locationId) && uuidPattern.test(locationId ?? "")));

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  const appendAssistantMessage = (message: Omit<Message, "type">) => {
    setMessages((prev) => [
      ...prev,
      {
        type: "assistant",
        ...message,
      },
    ]);
  };

  const trackImpressionAcceptance = (impressionId: string) => {
    setAcceptedImpressions((prev) => {
      if (prev.has(impressionId)) return prev;
      const next = new Set(prev);
      next.add(impressionId);
      return next;
    });
  };

  const sendMessage = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isTyping) {
      return;
    }

    if (!isAgentReady) {
      toast({
        title: "AI assistant unavailable",
        description:
          "Connect to the Supabase project and select an active location or table before using the assistant.",
      });
      return;
    }

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      type: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    try {
      const response = await callWaiterAgent({
        message: trimmed,
        session_id: sessionId,
        table_session_id: tableSessionId ?? undefined,
        location_id: locationId ?? undefined,
        language: language ?? undefined,
        allergies: allergies?.length ? allergies : undefined,
        cart: agentCartPayload.length ? agentCartPayload : undefined,
        age_verified: ageVerified ?? undefined,
      });

      setSessionId(response.session_id);

      appendAssistantMessage({
        id: `${Date.now()}-assistant`,
        content: response.reply,
        timestamp: new Date(),
        upsell: response.upsell,
        disclaimers: response.disclaimers,
        citations: response.citations,
        costUsd: response.cost_usd,
      });
    } catch (error) {
      const description =
        error instanceof Error ? error.message : "We couldn't reach the ICUPA agents service.";
      toast({
        title: "Agent request failed",
        description,
        variant: "destructive",
      });
      appendAssistantMessage({
        id: `${Date.now()}-assistant-error`,
        content:
          "I'm having trouble reaching the ICUPA team right now. Please try again in a moment or ask a staff member for help.",
        timestamp: new Date(),
        disclaimers: [description],
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };

  const addSuggestionToCart = (suggestion: UpsellSuggestion) => {
    addCartItem({
      id: suggestion.item_id,
      name: suggestion.name,
      priceCents: suggestion.price_cents,
    });
    toast({
      title: `${suggestion.name} added to cart`,
      description: suggestion.rationale,
    });

    if (suggestion.impression_id) {
      trackImpressionAcceptance(suggestion.impression_id);
      void markRecommendationAccepted(suggestion.impression_id).catch((error) => {
        console.error("Failed to acknowledge recommendation impression", error);
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 pb-32" aria-live="polite">
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
                <p className="text-sm text-muted-foreground">
                  Grounded recommendations powered by your Supabase menu
                </p>
              </div>
              <Badge
                variant="outline"
                className={`ml-auto border-success/30 ${isAgentReady ? "bg-success/20 text-success" : "bg-amber-100 text-amber-600"}`}
              >
                <Sparkles className="w-3 h-3 mr-1" />
                {isAgentReady ? "Online" : "Offline"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div
        className="flex-1 space-y-4 overflow-y-auto"
        role="log"
        aria-relevant="additions text"
      >
        {!isAgentReady && (
          <Alert className="glass-card border border-amber-200/60 bg-amber-50/60 text-amber-900 dark:border-amber-300/40 dark:bg-amber-900/30 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Connect the agents service</AlertTitle>
            <AlertDescription>
              Configure <code>VITE_AGENTS_SERVICE_URL</code> and ensure your Supabase data is available to unlock
              AI-powered waiter responses.
            </AlertDescription>
          </Alert>
        )}

        {messages.map((message, index) => (
          <motion.div
            key={message.id}
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: prefersReducedMotion ? 0 : index * 0.05 }}
            className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[80%] ${message.type === "user" ? "order-2" : "order-1"}`}>
              <Card
                className={`glass-card border-0 ${
                  message.type === "user" ? "bg-primary-gradient text-primary-foreground" : ""
                }`}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    {message.type === "assistant" && (
                      <Bot className="w-4 h-4 mt-0.5 text-primary" aria-hidden="true" />
                    )}
                    {message.type === "user" && (
                      <User className="w-4 h-4 mt-0.5 text-primary-foreground" aria-hidden="true" />
                    )}
                    <div className="flex-1 space-y-3">
                      <div>
                        <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            message.type === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}
                        >
                          {message.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {typeof message.costUsd === "number" && (
                            <span className="ml-2 text-xs opacity-70">
                              Cost {(message.costUsd ?? 0).toFixed(4)} USD
                            </span>
                          )}
                        </p>
                      </div>

                      {message.citations && message.citations.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {message.citations.map((citation) => (
                            <Badge key={citation} variant="outline" className="text-xs">
                              {citation}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {message.upsell && message.upsell.length > 0 && (
                        <div className="space-y-2">
                          {message.upsell.map((suggestion) => {
                            const isAccepted =
                              suggestion.impression_id &&
                              acceptedImpressions.has(suggestion.impression_id);
                            return (
                              <Card key={suggestion.item_id} className="border border-primary/20 bg-background/40">
                                <CardContent className="p-3 space-y-2">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-semibold text-sm">{suggestion.name}</p>
                                    <p className="text-xs text-muted-foreground whitespace-pre-line">
                                      {suggestion.rationale}
                                    </p>
                                  </div>
                                  <p className="text-sm font-medium text-primary">
                                    {formatCurrency(suggestion.price_cents, suggestion.currency, language ?? undefined)}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {suggestion.citations.map((citation) => (
                                    <Badge key={citation} variant="outline" className="text-[10px] uppercase tracking-wide">
                                      {citation}
                                    </Badge>
                                  ))}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {suggestion.allergens.length > 0 && (
                                    <Badge variant="destructive" className="text-[10px]">
                                      Contains: {suggestion.allergens.join(", ")}
                                    </Badge>
                                  )}
                                  {suggestion.tags.slice(0, 3).map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-[10px] uppercase">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="bg-primary-gradient hover:opacity-90"
                                  onClick={() => addSuggestionToCart(suggestion)}
                                  disabled={Boolean(isAccepted)}
                                >
                                  {isAccepted ? "Added" : "Add to cart"}
                                </Button>
                              </CardContent>
                            </Card>
                            );
                          })}
                        </div>
                      )}

                      {message.disclaimers && message.disclaimers.length > 0 && (
                        <div className="space-y-1">
                          {message.disclaimers.map((disclaimer, idx) => (
                            <p key={idx} className="text-xs text-amber-600">
                              {disclaimer}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {message.type === "assistant" && message.suggestions && (
                <motion.div
                  initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: prefersReducedMotion ? 0 : 0.2 }}
                  className="mt-2 flex flex-wrap gap-2"
                >
                  {message.suggestions.map((suggestion) => (
                    <Button
                      key={suggestion}
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
                  <Bot className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4"
      >
        <Card className="glass-card border-0">
          <CardContent className="p-3">
            <form className="flex gap-2" onSubmit={handleSubmit} aria-label="Send a message to the ICUPA assistant">
              <label htmlFor="icupa-chat-input" className="sr-only">
                Ask ICUPA anything
              </label>
              <Input
                id="icupa-chat-input"
                placeholder={isAgentReady ? "Ask ICUPA anything..." : "Link your table to enable AI assistance"}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                className="bg-background/50 border-border/50 rounded-xl"
                aria-describedby="icupa-chat-helper"
                disabled={!isAgentReady}
              />
              <Button
                type="submit"
                disabled={!inputValue.trim() || isTyping || !isAgentReady}
                className="bg-primary-gradient hover:opacity-90 transition-opacity rounded-xl px-4"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                <span className="sr-only">Send</span>
              </Button>
            </form>
            <p id="icupa-chat-helper" className="sr-only">
              Press enter or use the send button to submit your question.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
