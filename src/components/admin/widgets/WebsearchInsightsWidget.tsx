import { Card } from "@icupa/ui/card";
import { ScrollArea } from "@icupa/ui/scroll-area";
import { Badge } from "@icupa/ui/badge";
import { useWebsearchInsights } from "@/hooks/useWebsearchInsights";
import type { AdminTenant } from "@/hooks/useAdminTenants";

interface WebsearchInsightsWidgetProps {
  tenant: AdminTenant | null;
}

export function WebsearchInsightsWidget({ tenant }: WebsearchInsightsWidgetProps) {
  const { data, isLoading, isError } = useWebsearchInsights(tenant?.id ?? null);

  if (!tenant) {
    return (
      <Card className="glass-card border border-white/10 bg-white/10 p-6 text-white">
        <p className="text-sm text-white/70">Select a tenant to review websearch activity.</p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="glass-card border border-white/10 bg-white/10 p-6 text-white">
        <p className="text-sm text-white/70">Loading recent searches…</p>
      </Card>
    );
  }

  if (isError || !data || data.length === 0) {
    return (
      <Card className="glass-card border border-white/10 bg-white/10 p-6 text-white">
        <p className="text-sm text-white/70">No websearch traffic recorded for this tenant.</p>
      </Card>
    );
  }

  return (
    <Card className="glass-card border border-white/10 bg-white/10 p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Websearch insights</p>
          <p className="text-sm text-white/70">Most recent queries executed by AI agents.</p>
        </div>
        <Badge className="bg-white/10 text-white">{data.length} queries</Badge>
      </div>

      <ScrollArea className="mt-4 h-64">
        <ul className="space-y-3">
          {data.map((entry) => (
            <li key={entry.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">{entry.query}</span>
                {entry.agentType ? <Badge className="bg-white/10 text-white/80">{entry.agentType}</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-white/60">
                {new Date(entry.createdAt).toLocaleString()} • {entry.source}
                {entry.latencyMs ? ` • ${entry.latencyMs}ms` : null}
              </p>
              {entry.results.length > 0 ? (
                <ul className="mt-3 space-y-2 text-xs text-white/80">
                  {entry.results.slice(0, 2).map((result, index) => (
                    <li key={`${entry.id}-${index}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="font-medium text-white">{result.title}</p>
                      <p className="mt-1 text-[11px] text-white/60">{result.snippet}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </ScrollArea>
    </Card>
  );
}
