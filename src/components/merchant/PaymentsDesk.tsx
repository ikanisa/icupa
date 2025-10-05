import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/currency";
import type { MerchantLocation } from "@/hooks/useMerchantLocations";
import { useOutstandingPayments, type OutstandingPayment } from "@/hooks/useOutstandingPayments";
import { usePaymentActionEvents } from "@/hooks/usePaymentActionEvents";

interface PaymentsDeskProps {
  location: MerchantLocation | null;
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  authorized: "secondary",
  captured: "default",
  refunded: "secondary",
  failed: "destructive",
};

const METHOD_LABELS: Record<string, string> = {
  stripe: "Stripe",
  adyen: "Adyen",
  mtn_momo: "MTN MoMo",
  airtel_money: "Airtel Money",
  cash: "Cash",
  card_on_prem: "Card (premises)",
};

function resolveLocale(currency: string) {
  switch (currency) {
    case "RWF":
      return "rw-RW";
    case "EUR":
    default:
      return "en-GB";
  }
}

function ManualCaptureDialog({
  payment,
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: {
  payment: OutstandingPayment | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onConfirm: (payload: { amount?: number; providerRef?: string; notes?: string }) => Promise<void> | void;
  isLoading: boolean;
}) {
  const [amount, setAmount] = useState<string>("");
  const [providerRef, setProviderRef] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (!payment) {
      setAmount("");
      setProviderRef("");
      setNotes("");
      return;
    }
    setAmount(payment.amountCents.toString());
    setProviderRef(payment.providerRef ?? "");
    setNotes("");
  }, [payment]);

  const handleConfirm = async () => {
    if (!payment) return;
    const parsedAmount = amount ? Number.parseInt(amount, 10) : undefined;
    try {
      await onConfirm({
        amount: Number.isFinite(parsedAmount) ? parsedAmount : undefined,
        providerRef: providerRef.trim() ? providerRef.trim() : undefined,
        notes: notes.trim() ? notes.trim() : undefined,
      });
    } catch (error) {
      // surfaced by caller
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manual capture</DialogTitle>
          <DialogDescription>
            Confirm the settlement details before marking the payment as captured and triggering fiscalisation.
          </DialogDescription>
        </DialogHeader>
        {payment ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="manual-capture-amount">Captured amount (cents)</Label>
              <Input
                id="manual-capture-amount"
                type="number"
                inputMode="numeric"
                min={0}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="manual-capture-provider">Provider reference</Label>
              <Input
                id="manual-capture-provider"
                placeholder="e.g. cash-drawer-42"
                value={providerRef}
                onChange={(event) => setProviderRef(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="manual-capture-notes">Notes (optional)</Label>
              <Textarea
                id="manual-capture-notes"
                placeholder="Add context for your teammates"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
              />
            </div>
          </div>
        ) : null}
        <DialogFooter className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm capture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PaymentsDesk({ location }: PaymentsDeskProps) {
  const { payments, isLoading, isRefetching, capturePayment, refetch } = useOutstandingPayments(location ?? null);
  const paymentIds = useMemo(() => payments.map((payment) => payment.paymentId), [payments]);
  const { data: actionMap = {}, isLoading: actionsLoading } = usePaymentActionEvents(paymentIds);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<OutstandingPayment | null>(null);

  const openDialog = (payment: OutstandingPayment) => {
    setSelectedPayment(payment);
    setDialogOpen(true);
  };

  const closeDialog = (nextOpen: boolean) => {
    if (!nextOpen) {
      setDialogOpen(false);
      setSelectedPayment(null);
    } else {
      setDialogOpen(true);
    }
  };

  const handleConfirm = async ({ amount, providerRef, notes }: { amount?: number; providerRef?: string; notes?: string }) => {
    if (!selectedPayment) return;
    try {
      await capturePayment.mutateAsync({
        paymentId: selectedPayment.paymentId,
        captureAmountCents: amount,
        providerRef,
        notes,
      });
      toast({ title: "Payment captured", description: "The payment has been marked as settled." });
      closeDialog(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to capture payment",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="glass-card border-white/10 bg-white/5 p-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="mt-4 h-16 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Payments desk</h2>
          <p className="text-sm text-white/70">
            Review pending settlements, capture cash payments, and monitor provider issues across the floor.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          {isRefetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {payments.length === 0 ? (
        <Card className="glass-card border-white/10 bg-white/5 p-6 text-white/70">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-300" />
            <div>
              <p className="font-medium text-white">All settled</p>
              <p className="text-sm text-white/70">There are no outstanding payments for this location.</p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => {
            const supportedCurrency = payment.currency === "RWF" ? "RWF" : "EUR";
            const locale = resolveLocale(payment.currency);
            const displayAmount = formatCurrency(payment.amountCents, supportedCurrency, locale);
            const totalAmount = formatCurrency(payment.totalCents, supportedCurrency, locale);
            const actions = actionMap[payment.paymentId] ?? [];
            const statusVariant = STATUS_VARIANTS[payment.paymentStatus] ?? "outline";
            const methodLabel = METHOD_LABELS[payment.method] ?? payment.method;
            const isManualCaptureDisabled = capturePayment.isLoading && selectedPayment?.paymentId === payment.paymentId;

            return (
              <Card key={payment.paymentId} className="glass-card border-white/10 bg-white/5">
                <CardHeader className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      Table {payment.tableCode ?? "?"}
                      <Badge variant={statusVariant} className="capitalize">
                        {payment.paymentStatus}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-white/70">
                      Order status <span className="font-medium text-white">{payment.orderStatus}</span> · Method {methodLabel}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold text-white">{displayAmount}</p>
                    <p className="text-white/60">Order total {totalAmount}</p>
                    {payment.createdAt ? (
                      <p className="text-xs text-white/50">
                        Created {formatDistanceToNow(new Date(payment.createdAt), { addSuffix: true })}
                      </p>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {payment.failureReason ? (
                    <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
                      <AlertTriangle className="mt-0.5 h-4 w-4" />
                      <span>{payment.failureReason}</span>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
                    <span>Provider ref:</span>
                    <Badge variant="outline" className="bg-white/10 text-xs text-white">
                      {payment.providerRef ?? "not set"}
                    </Badge>
                    {payment.capturedAt ? (
                      <span className="text-xs text-emerald-300">
                        Captured {formatDistanceToNow(new Date(payment.capturedAt), { addSuffix: true })}
                      </span>
                    ) : null}
                    {payment.capturedNotes ? (
                      <span className="text-xs italic text-white/60">“{payment.capturedNotes}”</span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      size="sm"
                      onClick={() => openDialog(payment)}
                      disabled={isManualCaptureDisabled}
                    >
                      Mark as captured
                    </Button>
                    <Badge variant="outline" className="bg-white/10 text-white/70">
                      {payment.tableState ? `Table state: ${payment.tableState}` : "Table state unavailable"}
                    </Badge>
                  </div>

                  {actionsLoading && actions.length === 0 ? (
                    <Skeleton className="h-4 w-32" />
                  ) : null}

                  {actions.length > 0 ? (
                    <div className="space-y-2 text-xs text-white/60">
                      <Separator className="border-white/10" />
                      {actions.map((action) => (
                        <div key={action.id} className="flex items-center justify-between gap-2">
                          <span className="font-medium text-white">{action.action.replace(/_/g, " ")}</span>
                          <span>
                            {formatDistanceToNow(new Date(action.createdAt), { addSuffix: true })}
                            {action.notes ? ` · ${action.notes}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ManualCaptureDialog
        payment={selectedPayment}
        open={dialogOpen}
        onOpenChange={closeDialog}
        onConfirm={handleConfirm}
        isLoading={capturePayment.isLoading}
      />
    </div>
  );
}
