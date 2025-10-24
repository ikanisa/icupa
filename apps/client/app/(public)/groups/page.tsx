import Link from "next/link";
import { Badge, CardGlass, buttonClassName } from "@ecotrips/ui";
import type { GroupSuggestion } from "@ecotrips/types";

import { emitAgentEvent } from "../lib/agentTelemetry";
import { requestGroupSuggestions } from "../lib/groupSuggestions";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const response = await requestGroupSuggestions({
    budget_hint: "balanced",
    locale: "en",
  });

  const suggestions = response.suggestions ?? [];

  if (response.session_id) {
    await emitAgentEvent({
      sessionId: response.session_id,
      event: "groups.suggest.page_render",
      payload: {
        request_id: response.request_id ?? null,
        suggestion_count: suggestions.length,
      },
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 pb-24 pt-10">
      <CardGlass
        title="Group planning concierge"
        subtitle="PlannerCoPilot curates offsites, retreats, and summits with carbon accounting built in."
      >
        <p className="text-sm text-white/80">
          Share a destination, travel window, or headcount and we will draft a split-pay escrow, carbon impact model,
          and supplier roll-up within one business day. Suggestions below refresh from our edge network even when
          suppliers are offline.
        </p>
      </CardGlass>
      {suggestions.length === 0 ? (
        <CardGlass title="Fixtures active" subtitle="Connect to Supabase to fetch live suggestions.">
          <p className="text-sm text-white/70">
            Offline fixtures keep the experience resilient. Once Supabase credentials are configured the page will
            hydrate with fresh group recommendations from PlannerCoPilot.
          </p>
        </CardGlass>
      ) : (
        suggestions.map((suggestion: GroupSuggestion) => (
          <CardGlass key={suggestion.id} title={suggestion.title} subtitle={suggestion.summary}>
            {suggestion.badges.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {suggestion.badges.map((badge) => (
                  <Badge key={`${suggestion.id}-${badge.label}`} tone={badge.tone}>
                    {badge.label}
                  </Badge>
                ))}
              </div>
            )}
            {suggestion.actions.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-3">
                {suggestion.actions.map((action) => {
                  if (action.href) {
                    return (
                      <Link key={`${suggestion.id}-${action.label}`} href={action.href} className={buttonClassName("glass")}>
                        {action.label}
                      </Link>
                    );
                  }
                  return (
                    <Link
                      key={`${suggestion.id}-${action.label}`}
                      href={`/chat?topic=${encodeURIComponent(suggestion.id)}`}
                      className={buttonClassName("secondary")}
                    >
                      {action.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </CardGlass>
        ))
      )}
    </div>
  );
}
