'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Textarea } from '@icupa/ui';
import { quickIntents } from '../data/menu';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const STARTER_MESSAGES: ChatMessage[] = [
  {
    role: 'assistant',
    content:
      'Hi there! I\'m your AI waiter. Ask for recommendations, allergens, or help splitting the bill and I\'ll take care of it.',
  },
];

export function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(STARTER_MESSAGES);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const sendMessage = (value: string) => {
    if (!value.trim()) {
      return;
    }
    const userMessage: ChatMessage = { role: 'user', content: value.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsThinking(true);
    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content:
          'Here\'s a preview response. In production this will call the waiter agent to pull live menu data and craft the perfect pairing.',
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsThinking(false);
    }, 600);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="space-y-2 text-center text-white">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/80">
          <Sparkles className="h-4 w-4" aria-hidden /> AI Waiter preview
        </div>
        <h1 className="text-4xl font-semibold">How can I make your table smile?</h1>
        <p className="text-base text-white/70">
          Ask about allergens, pairings, splits, or let us suggest a signature round. Responses stream in seconds.
        </p>
      </header>

      <section className="flex flex-wrap justify-center gap-2">
        {quickIntents.map((intent) => (
          <Button
            key={intent}
            variant="outline"
            onClick={() => sendMessage(intent)}
            className="glass-surface border-white/20 text-white hover:bg-white/10"
          >
            {intent}
          </Button>
        ))}
      </section>

      <Card className="glass-surface border-white/10 bg-white/5 text-white">
        <CardHeader>
          <CardTitle className="text-xl">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.map((message, index) => (
            <motion.div
              key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={
                message.role === 'assistant'
                  ? 'flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3'
                  : 'flex items-start justify-end'
              }
            >
              {message.role === 'assistant' ? (
                <Badge variant="outline" className="mt-1 border-white/15 text-xs uppercase tracking-wide text-white/70">
                  Waiter
                </Badge>
              ) : null}
              <p className="max-w-[80%] text-sm text-white/90">{message.content}</p>
            </motion.div>
          ))}
          {isThinking ? <p className="text-sm text-white/60">Waiter is thinking…</p> : null}
        </CardContent>
      </Card>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage(input);
        }}
        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
      >
        <label htmlFor="chat-input" className="text-sm font-medium text-white">
          Ask anything
        </label>
        <Textarea
          id="chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={3}
          className="resize-none border-white/10 bg-transparent text-white placeholder:text-white/60"
          placeholder="Ask for pairings, allergens, or to split the bill"
        />
        <Button type="submit" className="self-end glass-surface bg-white/15 text-white hover:bg-white/20" disabled={isThinking}>
          Send <Send className="ml-2 h-4 w-4" aria-hidden />
        </Button>
      </form>
    </div>
  );
}
