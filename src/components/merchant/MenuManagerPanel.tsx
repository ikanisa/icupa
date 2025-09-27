import { useMemo } from "react";
import { Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useMenuManager } from "@/hooks/useMenuManager";
import type { MerchantLocation } from "@/hooks/useMerchantLocations";

interface MenuManagerPanelProps {
  location: MerchantLocation | null;
}

export function MenuManagerPanel({ location }: MenuManagerPanelProps) {
  const { items, suggestions, isLoading, toggleAvailability, requestSuggestion, approveSuggestion, rejectSuggestion } =
    useMenuManager(location ?? undefined);

  const pendingSuggestions = useMemo(() => suggestions.filter((item) => item.status === "pending"), [suggestions]);
  const historicalSuggestions = useMemo(() => suggestions.filter((item) => item.status !== "pending"), [suggestions]);
  const locale = location?.region === "EU" ? "en-MT" : "en-RW";
  const currency = location?.currency === "EUR" ? "EUR" : "RWF";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Menu manager</h2>
          <p className="text-sm text-muted-foreground">
            Toggle availability instantly and review AI-assisted copy rewrites before they go live.
          </p>
        </div>
        <Badge variant="outline" className="border-white/10 bg-white/10 text-xs text-white/80">
          {pendingSuggestions.length} awaiting approval
        </Badge>
      </header>

      <Card className="glass-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Live catalogue</h3>
          <span className="text-xs text-muted-foreground">{items.length} items</span>
        </div>
        <Separator className="my-4 bg-white/10" />
        <div className="space-y-4">
          {isLoading
            ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)
            : items.map((item) => {
                const disabled = toggleAvailability.isPending;
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/5 bg-white/5 p-4 transition hover:border-primary/50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-base font-semibold">{item.name}</h4>
                        <p className="text-xs text-white/70">{item.description || "No description yet."}</p>
                      </div>
                      <div className="text-right text-sm font-semibold text-white/80">
                        {formatCurrency(item.priceCents, currency, locale)}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={item.isAvailable}
                          onCheckedChange={(next) => toggleAvailability.mutate({ itemId: item.id, isAvailable: next })}
                          disabled={disabled}
                        />
                        <span className="text-xs text-white/70">Visible in diner app</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-2 text-xs text-white/80"
                        onClick={() => requestSuggestion.mutate(item)}
                        disabled={requestSuggestion.isPending}
                      >
                        <Wand2 className="h-4 w-4" /> Draft AI rewrite
                      </Button>
                    </div>
                  </div>
                );
              })}
        </div>
      </Card>

      <Card className="glass-card p-6">
        <h3 className="text-lg font-semibold">Pending approvals</h3>
        <Separator className="my-4 bg-white/10" />
        <div className="space-y-6">
          {pendingSuggestions.length === 0 && (
            <p className="text-sm text-muted-foreground">All caught up — no pending suggestions right now.</p>
          )}
          {pendingSuggestions.map((suggestion) => (
            <div key={suggestion.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold">{suggestion.suggestedName}</h4>
                  <p className="text-xs text-muted-foreground">Locale {suggestion.locale}</p>
                </div>
                <Badge variant="secondary">Awaiting review</Badge>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <DiffBlock title="Current copy" body={suggestion.currentDescription ?? "–"} subdued />
                <DiffBlock title="Suggested" body={suggestion.suggestedDescription} highlight />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/70">
                <span>Rationale: {suggestion.rationale ?? "Auto generated"}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button size="sm" onClick={() => approveSuggestion.mutate(suggestion)} disabled={approveSuggestion.isPending}>
                  Approve &amp; publish
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const reason = window.prompt("Why are you rejecting this draft?", "Tone mismatch");
                    if (!reason) return;
                    rejectSuggestion.mutate({ suggestion, reason });
                  }}
                  disabled={rejectSuggestion.isPending}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {historicalSuggestions.length > 0 && (
        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold">Audit trail</h3>
          <Separator className="my-4 bg-white/10" />
          <div className="space-y-4 text-sm">
            {historicalSuggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="flex flex-wrap items-center justify-between rounded-2xl border border-white/5 bg-white/5 p-4"
              >
                <div>
                  <p className="font-medium">{suggestion.suggestedName}</p>
                  <p className="text-xs text-white/60">{suggestion.status.toUpperCase()} · {new Date(suggestion.createdAt).toLocaleString()}</p>
                </div>
                <Badge variant={suggestion.status === "approved" ? "secondary" : "outline"}>
                  {suggestion.status === "approved" ? "Approved" : "Rejected"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function DiffBlock({ title, body, highlight, subdued }: { title: string; body: string; highlight?: boolean; subdued?: boolean }) {
  const words = body.split(/\s+/);
  return (
    <div className={cn("rounded-2xl border border-white/5 p-4 text-sm", highlight && "border-primary/50 bg-primary/10")}> 
      <p className="text-xs font-semibold uppercase tracking-wide text-white/60">{title}</p>
      <div className={cn("mt-2 space-y-1 leading-relaxed", subdued && "text-white/60")}> 
        <p>
          {words.map((word, idx) => (
            <span
              key={`${word}-${idx}`}
              className={cn(
                highlight && idx % 3 === 0 ? "bg-primary/30 px-1 text-primary-foreground" : undefined,
                subdued && ""
              )}
            >
              {word}
              {idx < words.length - 1 ? " " : ""}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
