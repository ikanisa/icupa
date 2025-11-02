import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AgentChatMessage, AgentFeedbackRating, AgentUpsellItem } from '@icupa/types/agents';
import { ChatMessageBubble } from './ChatMessageBubble';
import { ChatTypingIndicator } from './ChatTypingIndicator';

export interface ChatTranscriptProps {
  messages: AgentChatMessage[];
  isTyping?: boolean;
  typingAgent?: string | null;
  onInspectMetadata?: (message: AgentChatMessage) => void;
  onFeedback?: (message: AgentChatMessage, rating: AgentFeedbackRating) => void;
  feedbackPendingMessageId?: string | null;
  onUpsellAction?: (item: AgentUpsellItem) => void;
}

export function ChatTranscript({
  messages,
  isTyping = false,
  typingAgent,
  onInspectMetadata,
  onFeedback,
  feedbackPendingMessageId,
  onUpsellAction,
}: ChatTranscriptProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isTyping]);

  return (
    <ScrollArea className="h-full w-full pr-4">
      <div className="flex h-full flex-col gap-6">
        {messages.map((message) => (
          <ChatMessageBubble
            key={message.id}
            message={message}
            onInspectMetadata={onInspectMetadata}
            onFeedback={onFeedback}
            feedbackPending={feedbackPendingMessageId === message.id}
            onUpsellAction={onUpsellAction}
          />
        ))}
        {isTyping && (
          <ChatTypingIndicator
            agent={
              typingAgent ??
              (messages.length > 0
                ? messages[messages.length - 1]?.primaryAgentType ??
                  messages[messages.length - 1]?.metadata?.runs?.[0]?.agent_type ??
                  null
                : null)
            }
          />
        )}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  );
}
