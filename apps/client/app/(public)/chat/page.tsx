import { CardGlass, Badge } from "@ecotrips/ui";

import { GroupSuggestionChips } from "../components/GroupSuggestionChips";
import { emitAgentEvent } from "../lib/agentTelemetry";
import { requestGroupSuggestions } from "../lib/groupSuggestions";

type ChatPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const transcript = [
  {
    role: "traveler" as const,
    tone: "info" as const,
    message: "We're organizing a sustainability retreat in Rwanda. Looking for ideas with carbon reporting baked in.",
    at: "09:02",
  },
  {
    role: "ops" as const,
    tone: "success" as const,
    message:
      "Great timing! We'll tee up sample plans with split-pay escrows and carbon statements. PlannerCoPilot is curating options now.",
    at: "09:03",
  },
  {
    role: "ops" as const,
    tone: "neutral" as const,
    message:
      "Let us know headcount or travel window and we can refine holds before opening contributions.",
    at: "09:04",
  },
];

export const dynamic = "force-dynamic";

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const topicParam = searchParams?.topic;
  const topic = Array.isArray(topicParam) ? topicParam[0] : topicParam;

  const response = await requestGroupSuggestions({
    locale: "en",
    topic: topic?.trim() || undefined,
  });

  if (response.session_id) {
    await emitAgentEvent({
      sessionId: response.session_id,
      event: "groups.suggest.chat_render",
      payload: {
        request_id: response.request_id ?? null,
        topic: topic ?? null,
        suggestion_count: response.suggestions?.length ?? 0,
      },
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 pb-24 pt-10">
      <CardGlass
        title="Chat with PlannerCoPilot"
        subtitle="Ops replies in minutes with vetted suppliers, escrow guardrails, and carbon impact summaries."
      >
        <div className="space-y-6">
          <div className="space-y-4">
            {transcript.map((entry) => (
              <div key={`${entry.role}-${entry.at}`} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  <Badge tone={entry.tone === "success" ? "success" : entry.tone === "neutral" ? "neutral" : "info"}>
                    {entry.role === "ops" ? "Ops" : "Traveler"}
                  </Badge>
                  <span className="text-xs uppercase tracking-wide text-white/60">{entry.at}</span>
                </div>
                <p className="text-sm text-white/80">{entry.message}</p>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">Suggested plans</p>
            <GroupSuggestionChips
              suggestions={response.suggestions ?? []}
              sessionId={response.session_id}
              followUp={response.follow_up ?? null}
            />
          </div>
        </div>
      </CardGlass>
    </div>
  );
}
