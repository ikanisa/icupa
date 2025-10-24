"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge, Button, Toast } from "@ecotrips/ui";
import { createEcoTripsFunctionClient } from "@ecotrips/api";
import type { GroupSuggestion, GroupSuggestionResponse } from "@ecotrips/types";

import { emitAgentEvent } from "../lib/agentTelemetry";
import { usePlannerRollout } from "./usePlannerRollout";

type ToastState = { id: string; title: string; description?: string } | null;

type GroupSuggestionChipsProps = {
  suggestions: GroupSuggestion[];
  sessionId?: string | null;
  followUp?: string | null;
};

export function GroupSuggestionChips({
  suggestions: initialSuggestions,
  sessionId: initialSessionId,
  followUp: initialFollowUp,
}: GroupSuggestionChipsProps) {
  const plannerRollout = usePlannerRollout();
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [sessionId, setSessionId] = useState(initialSessionId ?? null);
  const [followUp, setFollowUp] = useState(initialFollowUp ?? null);
  const [toast, setToast] = useState<ToastState>(null);
  const [pending, startTransition] = useTransition();

  const clientPromise = useMemo(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return null;
    }
    return createEcoTripsFunctionClient({
      supabaseUrl,
      anonKey,
      getAccessToken: async () => null,
    });
  }, []);

  const runSuggest = async (topic?: string) => {
    const client = await clientPromise;
    if (!client) {
      setToast({
        id: "offline",
        title: "Offline mode",
        description: "Configure Supabase credentials to load group ideas.",
      });
      return;
    }

    try {
      const response: GroupSuggestionResponse = await client.call("groups.suggest", {
        session_id: sessionId ?? undefined,
        topic,
      });

      setSuggestions(response.suggestions ?? []);
      setSessionId(response.session_id ?? sessionId ?? null);
      setFollowUp(response.follow_up ?? null);

      await emitAgentEvent({
        sessionId: response.session_id ?? sessionId ?? null,
        event: "chat.groups_suggest.cta",
        payload: {
          topic: topic ?? null,
          suggestion_count: response.suggestions?.length ?? 0,
          request_id: response.request_id ?? null,
        },
      });
    } catch (error) {
      console.error("groups.suggest", error);
      setToast({
        id: "error",
        title: "Request failed",
        description: "Unable to fetch fresh group ideas. Retry shortly.",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        {suggestions.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-white/70">
            {plannerRollout.enabled
              ? "PlannerCoPilot will surface new ideas once connectivity is restored."
              : "ConciergeGuide will surface new ideas once connectivity is restored."}
          </div>
        ) : (
          suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/90 md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-2 md:max-w-2xl">
                <p className="text-base font-semibold text-white">{suggestion.title}</p>
                <p className="text-white/70">{suggestion.summary}</p>
                {suggestion.badges.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {suggestion.badges.map((badge) => (
                      <Badge key={`${suggestion.id}-${badge.label}`} tone={badge.tone}>
                        {badge.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(suggestion.actions.length > 0
                  ? suggestion.actions
                  : [{ label: plannerRollout.enabled ? "Ask Planner" : "Request update", intent: "rerun" }]
                ).map((action) =>
                  action.href ? (
                    <Button key={`${suggestion.id}-${action.label}`} asChild variant="glass">
                      <a href={action.href}>{action.label}</a>
                    </Button>
                  ) : (
                    <Button
                      key={`${suggestion.id}-${action.label}`}
                      variant="glass"
                      disabled={pending}
                      onClick={() =>
                        startTransition(() => {
                          void runSuggest(suggestion.id);
                        })
                      }
                    >
                      {pending ? "Syncing…" : action.label}
                    </Button>
                  )
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {followUp && <p className="text-sm text-white/70">{followUp}</p>}
      <div className="fixed bottom-24 left-1/2 z-40 w-full max-w-sm -translate-x-1/2">
        {toast && (
          <Toast
            id={toast.id}
            title={toast.title}
            description={toast.description}
            onDismiss={() => setToast(null)}
          />
        )}
      </div>
    </div>
  );
}
