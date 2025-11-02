import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AgentChatMessage, AgentRunMetadata, AgentToolTrace } from '@icupa/types/agents';
import { CheckCircle2, XCircle } from 'lucide-react';
import { formatAgentCost } from '@/lib/agents';

export interface AgentRunDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: AgentChatMessage | null;
}

function renderToolStatus(status: AgentToolTrace['status']) {
  if (status === 'succeeded') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  }
  if (status === 'failed') {
    return <XCircle className="h-4 w-4 text-rose-400" />;
  }
  return <div className="h-2 w-2 rounded-full bg-white/40" />;
}

function RunRow({ run }: { run: AgentRunMetadata }) {
  const cost = formatAgentCost(run.cost_usd ?? null);
  const usage = run.usage ? `${run.usage.inputTokens}/${run.usage.outputTokens}` : null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-white/90">
        <Badge variant="outline" className="border-white/30 bg-white/10 text-xs uppercase tracking-wide text-white/70">
          {run.agent_type}
        </Badge>
        {run.model && <span className="text-white/60">{run.model}</span>}
        {cost && <span className="text-white/70">Cost {cost}</span>}
        {usage && <span className="text-white/60">Tokens {usage}</span>}
      </div>

      {run.tool_traces.length > 0 && (
        <div className="mt-4 space-y-3">
          {run.tool_traces.map((trace) => (
            <div
              key={trace.trace_id}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/80"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/60">
                  {renderToolStatus(trace.status)}
                  <span>{trace.tool}</span>
                </div>
                {trace.error && <span className="text-xs text-rose-300">{trace.error}</span>}
              </div>
              {trace.output && (
                <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-black/40 p-2 text-xs text-white/70">
                  {JSON.stringify(trace.output, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      {run.suggested_prompts.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/60">
          {run.suggested_prompts.map((prompt) => (
            <span key={prompt.id} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {prompt.prompt}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentRunDetailsDialog({ open, onOpenChange, message }: AgentRunDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-hidden border-white/10 bg-slate-950 text-white">
        <DialogHeader>
          <DialogTitle>Agent run details</DialogTitle>
          <DialogDescription className="text-white/60">
            Inspect tool traces, runtime costs, and suggested prompts emitted by the agents service.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-full max-h-[60vh] pr-6">
          <div className="space-y-4">
            {message?.metadata?.runs?.map((run, index) => (
              <RunRow key={`${run.agent_type}-${index}`} run={run} />
            )) ?? <p className="text-sm text-white/60">No agent metadata captured for this message.</p>}
          </div>
          {message?.metadata?.suggested_prompts?.length ? (
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-white/80">Suggested prompts</h4>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/60">
                {message.metadata.suggested_prompts.map((prompt) => (
                  <span key={prompt.id} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {prompt.prompt}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
