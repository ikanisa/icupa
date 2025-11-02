import { Button } from '/ui/button';

export interface ChatQuickRepliesProps {
  prompts: string[];
  onSelect: (prompt: string) => void;
}

export function ChatQuickReplies({ prompts, onSelect }: ChatQuickRepliesProps) {
  if (!prompts || prompts.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {prompts.slice(0, 6).map((prompt) => (
        <Button
          key={prompt}
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full border-white/20 bg-white/5 text-xs text-white/80 hover:bg-white/10"
          onClick={() => onSelect(prompt)}
          data-testid="agent-quick-reply"
        >
          {prompt}
        </Button>
      ))}
    </div>
  );
}
