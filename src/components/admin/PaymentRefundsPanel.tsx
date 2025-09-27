import { usePaymentRefunds, useRefundDecision } from "@/hooks/usePaymentRefunds";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

export function PaymentRefundsPanel() {
  const { data, isLoading, isError } = usePaymentRefunds();
  const refundMutation = useRefundDecision();
  const { toast } = useToast();

  async function handleDecision(refundId: string, decision: 'approve' | 'reject' | 'void') {
    try {
      await refundMutation.mutateAsync({ refundId, decision });
      toast({ title: `Refund ${decision}`, description: `Refund request ${decision}.` });
    } catch (error) {
      toast({
        title: `Failed to ${decision} refund`,
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
      <Card className="glass-card border border-destructive/30 bg-destructive/15 p-5 text-white">
        <p className="text-sm">Unable to load refund queue.</p>
      </Card>
    );
  }

  const refunds = data ?? [];

  return (
    <Card className="glass-card border border-white/10 bg-white/10 p-5 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Refund queue</p>
          <p className="text-sm text-white/70">Approve or reject pending refund/void requests.</p>
        </div>
        <Badge variant="outline" className="border-white/30 text-white/70">{refunds.length} pending</Badge>
      </div>

      <div className="mt-4 space-y-4">
        {refunds.length === 0 ? (
          <p className="text-sm text-white/70">No pending refund requests.</p>
        ) : (
          refunds.map((refund) => (
            <div key={refund.id} className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">Payment {refund.paymentId}</p>
                  <p className="text-xs text-white/60">
                    Requested {new Date(refund.createdAt).toLocaleString()} · Amount {refund.amountCents === null ? 'Full' : `${(refund.amountCents / 100).toFixed(2)} ${refund.currency}`}
                  </p>
                  {refund.reason ? <p className="text-xs text-white/60">Reason: {refund.reason}</p> : null}
                </div>
                <div className="flex gap-2">
                  <Button size="xs" variant="outline" onClick={() => handleDecision(refund.id, 'reject')} disabled={refundMutation.isPending}>
                    Reject
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => handleDecision(refund.id, 'void')} disabled={refundMutation.isPending}>
                    Void
                  </Button>
                  <Button size="xs" onClick={() => handleDecision(refund.id, 'approve')} disabled={refundMutation.isPending}>
                    Approve refund
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
