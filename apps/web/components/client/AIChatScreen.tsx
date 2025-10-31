import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@icupa/ui/button";
import { Textarea } from "@icupa/ui/textarea";
import { Send, Bot, User } from "lucide-react";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

export function AIChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "assistant",
      content: "Hello! I'm ICUPA, your AI dining assistant. I can help you find the perfect dishes, check for allergens, and suggest pairings. What would you like to know?",
      timestamp: new Date(),
      suggestions: [
        "What's popular today?",
        "I have a gluten allergy",
        "Suggest wine pairings",
        "What's the prep time for pasta?"
      ]
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);

  const sendMessage = async (overrideContent?: string) => {
    const messageText = (overrideContent ?? inputValue).trim();
    if (!messageText) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: "I understand you're looking for recommendations! Based on our current menu and your preferences, I'd suggest trying our Truffle Risotto - it's one of our most popular dishes with a 4.8-star rating. Would you like to know more about ingredients or see similar dishes?",
        timestamp: new Date(),
        suggestions: [
          "Tell me about ingredients",
          "Show similar dishes",
          "Add to cart",
          "Any allergens?"
        ]
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 2000);
  };

  const handleSuggestionClick = (suggestion: string) => {
    void sendMessage(suggestion);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  useEffect(() => {
    if (!textareaRef.current) return;
    const element = textareaRef.current;
    element.style.height = "auto";
    const nextHeight = Math.max(element.scrollHeight, 60);
    element.style.height = `${nextHeight}px`;
  }, [inputValue]);

  useEffect(() => {
    if (!endOfMessagesRef.current) return;
    endOfMessagesRef.current.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "end"
    });
  }, [messages, isTyping, prefersReducedMotion]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[#343541] text-white">
      <div
        className="flex-1 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {messages.map((message, index) => {
          const isAssistant = message.type === "assistant";

          return (
            <motion.div
              key={message.id}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : index * 0.05 }}
              className={`border-b border-white/5 ${isAssistant ? "bg-[#444654]" : "bg-transparent"}`}
            >
              <div className="mx-auto flex w-full max-w-3xl gap-4 px-6 py-8 text-sm leading-relaxed">
                <div
                  className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                    isAssistant ? "bg-[#10a37f] text-black" : "bg-[#2f2f36] text-white"
                  }`}
                  aria-hidden="true"
                >
                  {isAssistant ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>
                <div className="whitespace-pre-wrap text-sm text-white/90">
                  {message.content}
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-4 grid gap-2 text-xs text-white/60 sm:grid-cols-2">
                      {message.suggestions.map((suggestion, suggestionIndex) => (
                        <button
                          key={suggestionIndex}
                          type="button"
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="rounded-lg border border-white/10 bg-transparent px-3 py-2 text-left transition hover:border-white/20 hover:bg-white/5"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}

        {isTyping && (
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-b border-white/5 bg-[#444654]"
            role="status"
            aria-live="polite"
          >
            <div className="mx-auto flex w-full max-w-3xl gap-4 px-6 py-8 text-sm leading-relaxed">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#10a37f] text-black" aria-hidden="true">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 text-white/70">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white/60" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-white/60 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-white/60 [animation-delay:300ms]" />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={endOfMessagesRef} />
      </div>

      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-3xl px-6 pb-6 pt-4"
      >
        <form onSubmit={handleSubmit} aria-label="Send a message to the ICUPA assistant" className="space-y-3">
          <label htmlFor="icupa-chat-input" className="sr-only">
            Ask ICUPA anything
          </label>
          <div className="relative rounded-2xl border border-white/10 bg-[#40414f] px-4 pb-12 pt-3">
            <Textarea
              id="icupa-chat-input"
              ref={textareaRef}
              placeholder="Message ICUPA..."
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[60px] w-full resize-none border-0 bg-transparent px-0 text-sm text-white placeholder:text-white/40 focus-visible:ring-0"
              aria-describedby="icupa-chat-helper"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || isTyping}
              className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#19c37d] text-black transition hover:bg-[#15a86a] disabled:opacity-50"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <p id="icupa-chat-helper" className="text-center text-xs text-white/40">
            ICUPA can make mistakes. Consider checking important information.
          </p>
        </form>
      </motion.div>
    </div>
  );
}
