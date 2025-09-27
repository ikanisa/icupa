import { useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, Sparkles } from "lucide-react";

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

  const sendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    // Simulate AI response
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
    setInputValue(suggestion);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };

  return (
    <div className="flex-1 flex flex-col p-4 pb-32">
      {/* Chat Header */}
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
                <Sparkles className="w-3 h-3 mr-1" />
                Online
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Messages */}
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
            className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[80%] ${message.type === "user" ? "order-2" : "order-1"}`}>
              <Card className={`glass-card border-0 ${
                message.type === "user" 
                  ? "bg-primary-gradient text-primary-foreground" 
                  : ""
              }`}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    {message.type === "assistant" && (
                      <Bot className="w-4 h-4 mt-0.5 text-primary" />
                    )}
                    {message.type === "user" && (
                      <User className="w-4 h-4 mt-0.5 text-primary-foreground" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm leading-relaxed">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.type === "user" 
                          ? "text-primary-foreground/70" 
                          : "text-muted-foreground"
                      }`}>
                        {message.timestamp.toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Suggestions */}
              {message.suggestions && (
                <motion.div
                  initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: prefersReducedMotion ? 0 : 0.3 }}
                  className="mt-2 flex flex-wrap gap-2"
                >
                  {message.suggestions.map((suggestion, idx) => (
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
            </div>
          </motion.div>
        ))}

        {/* Typing Indicator */}
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
                      transition={{ duration: prefersReducedMotion ? 0 : 1.5, repeat: prefersReducedMotion ? 0 : Infinity, delay: 0 }}
                      className="w-2 h-2 bg-primary rounded-full"
                    />
                    <motion.div
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: prefersReducedMotion ? 0 : 1.5, repeat: prefersReducedMotion ? 0 : Infinity, delay: prefersReducedMotion ? 0 : 0.2 }}
                      className="w-2 h-2 bg-primary rounded-full"
                    />
                    <motion.div
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: prefersReducedMotion ? 0 : 1.5, repeat: prefersReducedMotion ? 0 : Infinity, delay: prefersReducedMotion ? 0 : 0.4 }}
                      className="w-2 h-2 bg-primary rounded-full"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Input */}
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
                placeholder="Ask ICUPA anything..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="bg-background/50 border-border/50 rounded-xl"
                aria-describedby="icupa-chat-helper"
              />
              <Button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
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