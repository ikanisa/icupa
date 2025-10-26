import { formatDistanceToNow } from "date-fns";
import { useAgentActionMutation, useAgentActionQueue, type AgentActionQueueItem } from "@/hooks/useAgentActionQueue";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";

interface AgentActionQueueProps {
  tenantId: string | null;
}

function Summary({ item }: { item: AgentActionQueueItem }) {
  if (item.actionType === "promo.update_campaign") {
    return (
      <p className="text-sm text-white/70">
        Update campaign <span className="font-semibold text-white">{item.payload.campaign_id as string}</span>
        {item.payload.status ? ` → ${item.payload.status}` : ""}
        {typeof item.payload.budget_delta_cents === "number" ? `, Δ budget ${(item.payload.budget_delta_cents as number) / 100} ` : ""}
      </p>
    );
  }

  if (item.actionType === "inventory.adjust_level") {
    return (
      <p className="text-sm text-white/70">
        Inventory <span className="font-semibold text-white">{item.payload.inventory_id as string}</span>
        {typeof item.payload.quantity === "number" ? ` → qty ${item.payload.quantity}` : ""}
        {typeof item.payload.auto_86 === "boolean" ? `, auto-86 ${item.payload.auto_86 ? "on" : "off"}` : ""}
      </p>
    );
  }

  return (
    <p className="text-sm text-white/70">{item.actionType}</p>
  );
}

export function AgentActionQueue({ tenantId }: AgentActionQueueProps) {
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useAgentActionQueue(tenantId);
  const mutation = useAgentActionMutation(tenantId);

  async function handleDecision(actionId: string, decision: "approve" | "reject" | "apply") {
    try {
      await mutation.mutateAsync({ actionId, decision });
      toast({ title: `Action ${decision}`, description: `Agent action ${decision} successfully.` });
      void refetch();
    } catch (error) {
      toast({ title: `Failed to ${decision}`, description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    }
  }

  if (!tenantId) {
    return (
      <Card className="glass-card border border-white/10 bg-white/10 p-5 text-white">
        <p className="text-sm text-white/70">Select a tenant to view queued agent actions.</p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="glass-card border border-white/10 bg-white/10 p-5 text-white">
        <Skeleton className="h-10 w-full bg-white/10" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="glass-card border border-destructive/40 bg-destructive/10 p-5 text-white">
        <p className="text-sm">Unable to load agent action queue.</p>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="glass-card border border-white/10 bg-white/10 p-5 text-white">
        <p className="text-sm text-white/70">No pending agent actions for this tenant.</p>
      </Card>
    );
  }

  return (
    <Card className="glass-card border border-white/10 bg-white/10 p-5 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/60">Agent action queue</p>
          <p className="text-sm text-white/70">Review and apply queued promo or inventory adjustments.</p>
        </div>
        {mutation.isPending && <Badge variant="outline" className="border-white/40 text-white">Processing…</Badge>}
      </div>

      <ul className="mt-4 space-y-4">
        {data.map((item) => (
          <li key={item.id} className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/20 text-primary-foreground/80 capitalize">{item.agentType}</Badge>
                <span className="text-xs text-white/60">
                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                </span>
              </div>
              <div className="flex gap-2">
                <Button size="xs" variant="outline" onClick={() => handleDecision(item.id, "approve")}>
                  Approve
                </Button>
                <Button size="xs" variant="destructive" onClick={() => handleDecision(item.id, "reject")}>
                  Reject
                </Button>
                <Button size="xs" onClick={() => handleDecision(item.id, "apply")}>
                  Apply change
                </Button>
              </div>
            </div>
            <Summary item={item} />
            {item.rationale ? (
              <p className="mt-2 text-xs text-white/60">Reason: {item.rationale}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
