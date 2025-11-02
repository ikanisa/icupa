import { FormEvent, useMemo, useState } from "react";
import { BarChart3, Pause, Play, Shield, StopCircle } from "lucide-react";
import { Badge } from "@icupa/ui/badge";
import { Button } from "@icupa/ui/button";
import { Card } from "@icupa/ui/card";
import { Input } from "@icupa/ui/input";
import { Label } from "@icupa/ui/label";
import { Separator } from "@icupa/ui/separator";
import { Textarea } from "@icupa/ui/textarea";
import { usePromoCampaigns } from "@/hooks/usePromoCampaigns";
import type { MerchantLocation } from "@/hooks/useMerchantLocations";
import type { PromoStatus } from "@/hooks/usePromoCampaigns";

interface PromoBuilderPanelProps {
  location: MerchantLocation | null;
}

export function PromoBuilderPanel({ location }: PromoBuilderPanelProps) {
  const { campaigns, isLoading, createCampaign, updateStatus } = usePromoCampaigns(location ?? undefined);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [epsilon, setEpsilon] = useState(0.05);
  const [budget, setBudget] = useState(50000);
  const [frequencyCap, setFrequencyCap] = useState(2);
  const [fairness, setFairness] = useState("{\n  \"max_per_guest_per_day\": 1\n}");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const tenantId = location?.tenantId ?? "00000000-0000-4000-8000-000000000001";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let fairnessConfig: Record<string, unknown> = {};
    try {
      fairnessConfig = fairness.trim().length ? JSON.parse(fairness) : {};
    } catch (error) {
      window.alert("Fairness constraints must be valid JSON");
      return;
    }

    createCampaign.mutate({
      tenantId,
      locationId: location?.id ?? null,
      name: name.trim(),
      description,
      epsilon,
      budgetCapCents: Math.max(0, Math.round(budget)),
      frequencyCap: Math.max(0, Math.round(frequencyCap)),
      fairnessConstraints: fairnessConfig,
      startsAt: startsAt || undefined,
      endsAt: endsAt || undefined,
    });

    setName("");
    setDescription("");
    setEpsilon(0.05);
    setBudget(50000);
    setFrequencyCap(2);
  };

  const sortedCampaigns = useMemo(() => campaigns.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [campaigns]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Promo builder</h2>
          <p className="text-sm text-muted-foreground">
            Launch epsilon-bandit experiments with guardrails for transparency and fairness.
          </p>
        </div>
        <Badge variant="outline" className="border-white/10 bg-white/10 text-xs text-white/80">
          <BarChart3 className="mr-2 h-4 w-4" /> Runtime caps enforced
        </Badge>
      </header>

      <Card className="glass-card p-6">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="md:col-span-1 space-y-2">
            <Label htmlFor="promo-name">Promo name</Label>
            <Input
              id="promo-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="Dessert Delight"
              className="glass-card border-white/10 bg-transparent"
            />
          </div>
          <div className="md:col-span-1 space-y-2">
            <Label htmlFor="promo-epsilon">Exploration rate (ε)</Label>
            <Input
              id="promo-epsilon"
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={epsilon}
              onChange={(event) => setEpsilon(Number(event.target.value))}
              className="glass-card border-white/10 bg-transparent"
            />
          </div>
          <div className="md:col-span-1 space-y-2">
            <Label htmlFor="promo-budget">Budget cap (cents)</Label>
            <Input
              id="promo-budget"
              type="number"
              min={0}
              value={budget}
              onChange={(event) => setBudget(Number(event.target.value))}
              className="glass-card border-white/10 bg-transparent"
            />
          </div>
          <div className="md:col-span-1 space-y-2">
            <Label htmlFor="promo-frequency">Frequency cap per guest</Label>
            <Input
              id="promo-frequency"
              type="number"
              min={0}
              value={frequencyCap}
              onChange={(event) => setFrequencyCap(Number(event.target.value))}
              className="glass-card border-white/10 bg-transparent"
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="promo-description">Description</Label>
            <Textarea
              id="promo-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Late night dessert booster"
              className="glass-card border-white/10 bg-transparent"
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="promo-fairness">Fairness constraints (JSON)</Label>
            <Textarea
              id="promo-fairness"
              value={fairness}
              onChange={(event) => setFairness(event.target.value)}
              rows={4}
              className="glass-card border-white/10 bg-transparent font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="promo-starts">Starts at</Label>
            <Input
              id="promo-starts"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className="glass-card border-white/10 bg-transparent"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="promo-ends">Ends at</Label>
            <Input
              id="promo-ends"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              className="glass-card border-white/10 bg-transparent"
            />
          </div>
          <div className="md:col-span-2 flex items-center justify-end gap-3">
            <Button type="reset" variant="ghost" onClick={() => setFairness("{\n  \"max_per_guest_per_day\": 1\n}")}>Reset</Button>
            <Button type="submit" disabled={createCampaign.isPending}>
              Launch review
            </Button>
          </div>
        </form>
      </Card>

      <Card className="glass-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Campaigns</h3>
          <Badge variant="outline" className="border-white/10 bg-white/10 text-xs text-white/80">
            {sortedCampaigns.length} configured
          </Badge>
        </div>
        <Separator className="my-4 bg-white/10" />
        <div className="space-y-4 text-sm">
          {isLoading && <p className="text-muted-foreground">Loading campaigns…</p>}
          {!isLoading && sortedCampaigns.length === 0 && (
            <p className="text-muted-foreground">No promo campaigns yet. Configure one above to get started.</p>
          )}
          {sortedCampaigns.map((campaign) => (
            <div key={campaign.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{campaign.name}</p>
                  <p className="text-xs text-white/60">ε = {campaign.epsilon.toFixed(2)} · Budget {campaign.budgetCapCents}¢</p>
                </div>
                <StatusBadge status={campaign.status} />
              </div>
              <p className="mt-2 text-xs text-white/70">{campaign.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/70">
                <span>Frequency cap: {campaign.frequencyCap} / guest</span>
                <span>Spent: {campaign.spentCents}¢</span>
                <span>
                  Window: {campaign.startsAt ? new Date(campaign.startsAt).toLocaleString() : "now"} →
                  {campaign.endsAt ? ` ${new Date(campaign.endsAt).toLocaleString()}` : " open"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => updateStatus.mutate({ id: campaign.id, status: nextStatus(campaign.status) })}
                  disabled={updateStatus.isPending || nextStatus(campaign.status) === campaign.status}
                >
                  {labelForAction(campaign.status)}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: campaign.id, status: "paused" })}>
                  Pause
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: PromoStatus }) {
  switch (status) {
    case "active":
      return (
        <Badge className="bg-emerald-500/20 text-emerald-100">
          <Play className="mr-1 h-3 w-3" /> Active
        </Badge>
      );
    case "pending_review":
      return (
        <Badge className="bg-amber-500/20 text-amber-100">
          <Shield className="mr-1 h-3 w-3" /> Pending review
        </Badge>
      );
    case "paused":
      return (
        <Badge className="bg-sky-500/20 text-sky-100">
          <Pause className="mr-1 h-3 w-3" /> Paused
        </Badge>
      );
    case "archived":
      return (
        <Badge className="bg-white/10 text-white/70">
          <StopCircle className="mr-1 h-3 w-3" /> Archived
        </Badge>
      );
    case "approved":
      return (
        <Badge className="bg-primary/20 text-primary-foreground">
          <Shield className="mr-1 h-3 w-3" /> Approved
        </Badge>
      );
    default:
      return <Badge variant="outline">Draft</Badge>;
  }
}

function nextStatus(status: PromoStatus): PromoStatus {
  if (status === "pending_review") return "approved";
  if (status === "approved" || status === "paused") return "active";
  if (status === "active") return "paused";
  return status;
}

function labelForAction(status: PromoStatus): string {
  if (status === "pending_review") return "Approve";
  if (status === "approved" || status === "paused") return "Activate";
  if (status === "active") return "Pause";
  return "Review";
}
