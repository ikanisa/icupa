import { useCallback } from 'react';
import { Textarea } from '/ui/textarea';
import { Button } from '/ui/button';
import { Send } from 'lucide-react';
import { ChatQuickReplies } from './ChatQuickReplies';

export interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  suggestions?: string[];
  onSelectSuggestion?: (prompt: string) => void;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = 'Ask anything…',
  suggestions,
  onSelectSuggestion,
}: ChatComposerProps) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (!disabled) {
          onSubmit();
        }
      }
    },
    [disabled, onSubmit]
  );

  const handleSuggestion = useCallback(
    (prompt: string) => {
      onChange(prompt);
      if (onSelectSuggestion) {
        onSelectSuggestion(prompt);
      }
    },
    [onChange, onSelectSuggestion]
  );

  return (
    <div className="space-y-3">
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        data-testid="agent-chat-input"
        className="min-h-[72px] resize-none rounded-3xl border-white/10 bg-white/5 text-white placeholder:text-white/50"
      />
      <div className="flex items-center justify-between gap-3">
        <ChatQuickReplies prompts={suggestions ?? []} onSelect={handleSuggestion} />
        <Button
          type="button"
          variant="gradient"
          size="sm"
          className="rounded-full px-5 py-2 text-sm"
          disabled={disabled}
          onClick={onSubmit}
          data-testid="agent-chat-send"
        >
          <Send className="h-4 w-4" />
          Send
        </Button>
      </div>
    </div>
  );
}
