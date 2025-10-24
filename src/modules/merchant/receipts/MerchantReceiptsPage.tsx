import { useMemo } from "react";
import { AlertCircle, FileText, Loader2, Printer, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Page,
  PageActions,
  PageContainer,
  PageDescription,
  PageHeader,
  PageTitle,
} from "@/components/layout/Page";
import { classNames } from "@/styles/theme";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { useMerchantReceipts } from "./hooks/useMerchantReceipts";

export const MerchantReceiptsPage = () => {
  const {
    receipts,
    hasReceipts,
    isLoading,
    isRefetching,
    error,
    refetch,
    renderTimestamp,
    regionLabelFor,
    processNext,
    isProcessing,
  } = useMerchantReceipts();

  const receiptCards = useMemo(() => {
    if (!hasReceipts) {
      return (
        <Card className={cn(classNames.glassCard, "border border-border/40")}>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No receipts have been issued yet. Captured payments will appear here automatically.
          </CardContent>
        </Card>
      );
    }

    return receipts.map((receipt) => {
      const totals = receipt.summary?.totals as Record<string, unknown> | undefined;
      const amountDisplay =
        totals && typeof totals.totalCents === "number"
          ? `${(totals.totalCents as number) / 100} ${String(totals.currency ?? "")}`
          : null;

      return (
        <Card key={receipt.id} className={cn(classNames.glassCard, "border border-border/40")}>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Order</p>
                <p className="font-semibold">{receipt.orderId.slice(0, 12)}</p>
              </div>
              <Badge variant="outline" className="text-xs uppercase">
                {regionLabelFor(receipt.region)}
              </Badge>
            </div>

            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Fiscal ID</p>
                <p className="font-medium">{receipt.fiscalId ?? "Pending"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Issued</p>
                <p className="font-medium">{renderTimestamp(receipt.createdAt)}</p>
              </div>
              {amountDisplay && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Total</p>
                  <p className="font-medium">{amountDisplay}</p>
                </div>
              )}
              {receipt.summary?.providerReference && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Provider ref</p>
                  <p className="font-medium">{String(receipt.summary.providerReference)}</p>
                </div>
              )}
            </div>

            <Separator className="opacity-40" />

            <div className="flex flex-wrap gap-2">
              {receipt.url && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="inline-flex items-center gap-2"
                  onClick={() => {
                    if (receipt.url && typeof window !== "undefined") {
                      window.open(receipt.url, "_blank", "noopener");
                    }
                  }}
                >
                  <FileText className="h-4 w-4" />
                  View receipt
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="inline-flex items-center gap-2"
                onClick={() => {
                  toast({
                    title: "Reprint logged",
                    description: `Ask the fiscal device to reprint receipt ${receipt.fiscalId ?? receipt.orderId}.`,
                  });
                }}
              >
                <Printer className="h-4 w-4" />
                Mark as reprinted
              </Button>
            </div>

            {receipt.integrationNotes?.steps && Array.isArray(receipt.integrationNotes.steps) && (
              <div className="space-y-2 rounded-xl border border-muted/40 bg-muted/10 p-4 text-xs text-muted-foreground">
                <p className="font-semibold text-muted-foreground">Next steps</p>
                <ul className="list-disc space-y-1 pl-4">
                  {receipt.integrationNotes.steps.map((step, index) => (
                    <li key={`${receipt.id}-step-${index}`}>{String(step)}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      );
    });
  }, [hasReceipts, receipts, regionLabelFor, renderTimestamp]);

  return (
    <Page>
      <PageContainer width="wide">
        <Card className={cn(classNames.glassCard, "border-0")}>
          <CardContent className="flex flex-wrap items-start justify-between gap-4 p-6">
            <PageHeader className="max-w-2xl gap-2">
              <PageTitle>Receipts & fiscalisation</PageTitle>
              <PageDescription>
                Monitor EBM and fiscal printer status, and retry the queue when something gets stuck.
              </PageDescription>
            </PageHeader>
            <PageActions>
              <Button
                variant="outline"
                className="inline-flex items-center gap-2"
                disabled={isLoading || isRefetching}
                onClick={() => refetch()}
              >
                <RefreshCcw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
                Refresh
              </Button>
              <Button
                className="inline-flex items-center gap-2"
                onClick={() => processNext()}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                Run queue
              </Button>
            </PageActions>
          </CardContent>
        </Card>

        {error && (
          <Card className="border border-destructive/40 bg-destructive/10 text-destructive">
            <CardContent className="flex items-start gap-3 p-4 text-sm">
              <AlertCircle className="mt-0.5 h-5 w-5" aria-hidden />
              <div>
                <p className="font-semibold">Unable to load receipts</p>
                <p>{error.message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <Card className={cn(classNames.glassCard, "border border-border/40")}>
            <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading receipts...
            </CardContent>
          </Card>
        ) : (
          receiptCards
        )}

        <Card className={cn(classNames.glassCard, "border border-border/40")}>
          <CardHeader>
            <CardTitle>Runbook: fiscal devices offline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              If Rwanda’s EBM 2.1 service or Malta’s fiscal printer fails, capture the payment and keep the receipt job in
              queue. Once the device is back, run the queue to regenerate the fiscal record and mark the incident in the audit
              log.
            </p>
            <p>
              <a
                href="/docs/runbooks/fiscalization.md"
                className="text-primary underline"
                target="_blank"
                rel="noreferrer"
              >
                Open the fiscalisation downtime runbook
              </a>
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </Page>
  );
};

export default MerchantReceiptsPage;
