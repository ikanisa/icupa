import { useReconciliationRuns, useRunReconciliation } from "@/hooks/useReconciliationRuns";
import { Card } from "@icupa/ui/card";
import { Button } from "@icupa/ui/button";
import { Badge } from "@icupa/ui/badge";
import { Skeleton } from "@icupa/ui/skeleton";
import { useToast } from "@icupa/ui/use-toast";

export function ReconciliationPanel() {
  const { data, isLoading, isError } = useReconciliationRuns();
  const runMutation = useRunReconciliation();
  const { toast } = useToast();

  async function handleRun() {
    try {
      await runMutation.mutateAsync({});
      toast({ title: 'Reconciliation triggered', description: 'Daily reconciliation run executed.' });
    } catch (error) {
      toast({
        title: 'Failed to trigger reconciliation',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    }
  }

  if (isLoading) {
    return <Skeleton className="h-40 w-full bg-white/10" />;
  }

  if (isError) {
    return (
      <Card className="glass-card border border-destructive/30 bg-destructive/20 p-5 text-white">
        <p className="text-sm">Unable to load reconciliation data.</p>
      </Card>
    );
  }

  const runs = data ?? [];

  return (
    <Card className="glass-card border border-white/10 bg-white/10 p-5 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Daily reconciliation</p>
          <p className="text-sm text-white/70">Captured totals, failures, and pending payments across the selected window.</p>
        </div>
        <Button size="sm" onClick={handleRun} disabled={runMutation.isPending}>
          {runMutation.isPending ? 'Running…' : 'Run now'}
        </Button>
      </div>

      <div className="mt-4 grid gap-3">
        {runs.length === 0 ? (
          <p className="text-sm text-white/70">No reconciliation runs recorded yet.</p>
        ) : (
          runs.map((run) => (
            <div key={run.id} className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {run.coverage_start} → {run.coverage_end}
                  </p>
                  <p className="text-xs text-white/60">
                    Captured ${(run.total_captured_cents / 100).toFixed(2)} · Pending {run.pending_payments} · Failed {run.total_failed}
                  </p>
                </div>
                <Badge variant="outline" className="border-white/30 text-white/70 capitalize">
                  {run.status}
                </Badge>
              </div>
              {run.notes ? <p className="mt-2 text-xs text-white/60">{run.notes}</p> : null}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
