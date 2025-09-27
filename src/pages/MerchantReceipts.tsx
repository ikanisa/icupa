import { useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import { Loader2, RefreshCcw, FileText, Printer, AlertCircle } from "lucide-react";

interface MerchantReceipt {
  id: string;
  orderId: string;
  fiscalId: string | null;
  region: string;
  url: string | null;
  createdAt: string | null;
  summary?: Record<string, any> | null;
  integrationNotes?: Record<string, any> | null;
}

interface FiscalizationJob {
  orderId: string;
  paymentId: string;
  status: string;
  attempts: number;
  lastError: string | null;
  lastAttemptAt: string | null;
  updatedAt: string | null;
  processedAt: string | null;
  receiptId: string | null;
}

const mapReceiptRow = (row: any): MerchantReceipt => {
  const payload = (row?.payload ?? {}) as Record<string, any>;
  const summary =
    typeof payload?.summary === "object" && payload.summary !== null
      ? (payload.summary as Record<string, any>)
      : null;
  const integrationNotes =
    typeof payload?.integration_notes === "object" && payload.integration_notes !== null
      ? (payload.integration_notes as Record<string, any>)
      : null;

  return {
    id: String(row?.id ?? ""),
    orderId: String(row?.order_id ?? ""),
    fiscalId:
      typeof row?.fiscal_id === "string" && row.fiscal_id.length > 0
        ? row.fiscal_id
        : typeof summary?.fiscalId === "string"
        ? (summary.fiscalId as string)
        : null,
    region:
      typeof row?.region === "string" && row.region.length > 0
        ? row.region
        : typeof summary?.region === "string"
        ? (summary.region as string)
        : "",
    url:
      typeof row?.url === "string" && row.url.length > 0
        ? row.url
        : typeof summary?.url === "string"
        ? (summary.url as string)
        : null,
    createdAt:
      typeof row?.created_at === "string"
        ? row.created_at
        : typeof summary?.issuedAtIso === "string"
        ? (summary.issuedAtIso as string)
        : null,
    summary,
    integrationNotes,
  } satisfies MerchantReceipt;
};

const mapJobRow = (row: any): FiscalizationJob => ({
  orderId: typeof row?.order_id === "string" ? row.order_id : String(row?.order_id ?? ""),
  paymentId: typeof row?.payment_id === "string" ? row.payment_id : String(row?.payment_id ?? ""),
  status: typeof row?.status === "string" ? row.status : "queued",
  attempts: Number.isFinite(row?.attempts) ? Number(row.attempts) : 0,
  lastError: typeof row?.last_error === "string" ? row.last_error : null,
  lastAttemptAt: typeof row?.last_attempt_at === "string" ? row.last_attempt_at : null,
  updatedAt: typeof row?.updated_at === "string" ? row.updated_at : null,
  processedAt: typeof row?.processed_at === "string" ? row.processed_at : null,
  receiptId: typeof row?.receipt_id === "string" ? row.receipt_id : null,
});

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  processing: "Processing",
  failed: "Needs attention",
  skipped: "Skipped",
  completed: "Completed",
};

const STATUS_VARIANTS: Record<string, "default" | "outline" | "secondary" | "destructive"> = {
  queued: "outline",
  processing: "secondary",
  failed: "destructive",
  skipped: "secondary",
  completed: "default",
};

const PENDING_STATUSES = new Set(["queued", "processing", "failed", "skipped"]);

const MerchantReceipts = () => {
  const {
    data: receipts = [],
    isLoading: receiptsLoading,
    isRefetching: receiptsRefetching,
    error: receiptsError,
    refetch: refetchReceipts,
  } = useQuery({
    queryKey: ["merchant-receipts"],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("receipts")
        .select("id, order_id, fiscal_id, region, url, payload, created_at")
        .order("created_at", { ascending: false })
        .limit(25);

      if (queryError) {
        throw new Error(queryError.message);
      }

      return (data ?? []).map(mapReceiptRow);
    },
    refetchInterval: 30000,
  });

  const {
    data: queueJobs = [],
    isLoading: jobsLoading,
    isRefetching: jobsRefetching,
    error: jobsError,
    refetch: refetchJobs,
  } = useQuery({
    queryKey: ["fiscalization-jobs"],
    queryFn: async () => {
      const { data, error: queueError } = await supabase
        .from("fiscalization_jobs")
        .select(
          "order_id, payment_id, status, attempts, last_error, last_attempt_at, updated_at, processed_at, receipt_id"
        )
        .order("updated_at", { ascending: false })
        .limit(20);

      if (queueError) {
        throw new Error(queueError.message);
      }

      return (data ?? []).map(mapJobRow);
    },
    refetchInterval: 45000,
  });

  const hasReceipts = receipts.length > 0;
  const pendingJobs = useMemo(
    () => queueJobs.filter((job) => PENDING_STATUSES.has(job.status.toLowerCase())),
    [queueJobs]
  );
  const hasPendingJobs = pendingJobs.length > 0;

  const { mutate: processNext, isPending: isProcessing } = useMutation({
    mutationFn: async () => {
      const { error: functionError } = await supabase.functions.invoke("receipts/process_queue", {
        body: {},
      });
      if (functionError) {
        throw new Error(functionError.message);
      }
    },
    onSuccess: () => {
      toast({
        title: "Queue run complete",
        description: "Checked for new fiscal receipts.",
      });
      void refetchReceipts();
      void refetchJobs();
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Queue run failed",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const renderTimestamp = useCallback((timestamp: string | null) => {
    if (!timestamp) return "--";
    try {
      return format(new Date(timestamp), "PPpp");
    } catch (_error) {
      return timestamp;
    }
  }, []);

  const renderRelativeTime = useCallback((timestamp: string | null) => {
    if (!timestamp) return "--";
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (_error) {
      return timestamp;
    }
  }, []);

  const cards = useMemo(() => {
    if (!hasReceipts) {
      return (
        <Card className="glass-card border border-border/40">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No receipts have been issued yet. Captured payments will appear here automatically.
          </CardContent>
        </Card>
      );
    }

    return receipts.map((receipt) => {
      const regionLabel = receipt.region?.toUpperCase() === "RW" ? "Rwanda EBM" : "Malta Fiscal";
      const totals = receipt.summary?.totals as Record<string, any> | undefined;
      const amountDisplay = totals?.totalCents
        ? `${(totals.totalCents as number) / 100} ${String(totals.currency ?? "")}`
        : null;

      return (
        <Card key={receipt.id} className="glass-card border border-border/40">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Order</p>
                <p className="font-semibold">{receipt.orderId.slice(0, 12)}</p>
              </div>
              <Badge variant="outline" className="text-xs uppercase">
                {regionLabel}
              </Badge>
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs uppercase">Fiscal ID</p>
                <p className="font-medium">{receipt.fiscalId ?? "Pending"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase">Issued</p>
                <p className="font-medium">{renderTimestamp(receipt.createdAt)}</p>
              </div>
              {amountDisplay && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase">Total</p>
                  <p className="font-medium">{amountDisplay}</p>
                </div>
              )}
              {receipt.summary?.providerReference && (
                <div>
                  <p className="text-muted-foreground text-xs uppercase">Provider ref</p>
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
                  <FileText className="w-4 h-4" />
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
                <Printer className="w-4 h-4" />
                Mark as reprinted
              </Button>
            </div>
            {receipt.integrationNotes?.steps && Array.isArray(receipt.integrationNotes.steps) && (
              <div className="rounded-xl border border-muted/40 bg-muted/10 p-4 text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-muted-foreground">Next steps</p>
                <ul className="list-disc space-y-1 pl-4">
                  {receipt.integrationNotes.steps.map((step: unknown, index: number) => (
                    <li key={`${receipt.id}-step-${index}`}>{String(step)}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      );
    });
  }, [hasReceipts, receipts, renderTimestamp]);

  const queueSummary = useMemo(() => {
    if (jobsLoading) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking queue health...
        </div>
      );
    }

    if (!hasPendingJobs) {
      return <p className="text-sm text-muted-foreground">All fiscalisation jobs are clear.</p>;
    }

    return (
      <div className="space-y-3">
        {pendingJobs.map((job) => {
          const statusKey = job.status.toLowerCase();
          const label = STATUS_LABELS[statusKey] ?? job.status;
          const badgeVariant = STATUS_VARIANTS[statusKey] ?? "secondary";
          const lastAttempt = job.lastAttemptAt ?? job.updatedAt;

          return (
            <div
              key={`${job.orderId}-${job.paymentId}`}
              className="rounded-xl border border-border/40 bg-background/40 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Order</p>
                  <p className="font-semibold">{job.orderId.slice(0, 12)}</p>
                </div>
                <Badge variant={badgeVariant} className="text-xs uppercase">
                  {label}
                </Badge>
              </div>
              <div className="mt-3 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
                <div>
                  <p className="uppercase tracking-wide">Attempts</p>
                  <p className="font-medium text-foreground">{job.attempts}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wide">Last activity</p>
                  <p className="font-medium text-foreground">{renderRelativeTime(lastAttempt)}</p>
                </div>
                <div>
                  <p className="uppercase tracking-wide">Updated</p>
                  <p className="font-medium text-foreground">{renderTimestamp(job.updatedAt)}</p>
                </div>
              </div>
              {job.lastError && (
                <p className="mt-3 text-xs text-destructive">Last error: {job.lastError}</p>
              )}
            </div>
          );
        })}
      </div>
    );
  }, [hasPendingJobs, jobsLoading, pendingJobs, renderRelativeTime, renderTimestamp]);

  const isRefreshing = receiptsRefetching || jobsRefetching;

  const handleRefresh = () => {
    void refetchReceipts();
    void refetchJobs();
  };

  return (
    <div className="min-h-screen bg-aurora px-4 py-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Card className="glass-card border-0">
          <CardContent className="p-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Receipts & fiscalisation</h1>
              <p className="text-sm text-muted-foreground">
                Monitor EBM and fiscal printer status, and retry the queue when something gets stuck.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="inline-flex items-center gap-2"
                disabled={receiptsLoading || jobsLoading || isRefreshing}
                onClick={handleRefresh}
              >
                <RefreshCcw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                className="inline-flex items-center gap-2"
                onClick={() => processNext()}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                Run queue
              </Button>
            </div>
          </CardContent>
        </Card>

        {jobsError && (
          <Card className="glass-card border border-destructive/40 bg-destructive/10 text-destructive">
            <CardContent className="p-4 flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to load fiscalisation queue</p>
                <p>{jobsError.message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="glass-card border border-border/40">
          <CardHeader>
            <CardTitle>Queue health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">{queueSummary}</CardContent>
        </Card>

        {receiptsError && (
          <Card className="glass-card border border-destructive/40 bg-destructive/10 text-destructive">
            <CardContent className="p-4 flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to load receipts</p>
                <p>{receiptsError.message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {receiptsLoading ? (
          <Card className="glass-card border border-border/40">
            <CardContent className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading receipts...
            </CardContent>
          </Card>
        ) : (
          cards
        )}

        <Card className="glass-card border border-border/40">
          <CardHeader>
            <CardTitle>Runbook: fiscal devices offline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              If Rwanda’s EBM 2.1 service or Malta’s fiscal printer fails, capture the payment and keep the receipt job
              in queue. Once the device is back, run the queue to regenerate the fiscal record and mark the incident in the
              audit log.
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
      </div>
    </div>
  );
};

export default MerchantReceipts;
