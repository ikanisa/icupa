import { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useSupabaseSessionHeaders } from "@/modules/supabase";
import type { MerchantReceipt } from "../types";

const RECEIPTS_QUERY_KEY = ["merchant-receipts"] as const;

const mapReceiptRow = (row: Record<string, unknown>): MerchantReceipt => {
  const payload = (row?.payload ?? {}) as Record<string, unknown>;
  const summary =
    typeof payload?.summary === "object" && payload.summary !== null
      ? (payload.summary as Record<string, unknown>)
      : null;
  const integrationNotes =
    typeof payload?.integration_notes === "object" && payload.integration_notes !== null
      ? (payload.integration_notes as Record<string, unknown>)
      : null;

  return {
    id: String(row?.id ?? ""),
    orderId: String(row?.order_id ?? ""),
    fiscalId:
      typeof row?.fiscal_id === "string" && row.fiscal_id.length > 0
        ? (row.fiscal_id as string)
        : typeof summary?.fiscalId === "string"
        ? (summary.fiscalId as string)
        : null,
    region:
      typeof row?.region === "string" && row.region.length > 0
        ? (row.region as string)
        : typeof summary?.region === "string"
        ? (summary.region as string)
        : "",
    url:
      typeof row?.url === "string" && row.url.length > 0
        ? (row.url as string)
        : typeof summary?.url === "string"
        ? (summary.url as string)
        : null,
    createdAt:
      typeof row?.created_at === "string"
        ? (row.created_at as string)
        : typeof summary?.issuedAtIso === "string"
        ? (summary.issuedAtIso as string)
        : null,
    summary,
    integrationNotes,
  } satisfies MerchantReceipt;
};

export const useMerchantReceipts = () => {
  const sessionHeaders = useSupabaseSessionHeaders();

  const query = useQuery({
    queryKey: RECEIPTS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipts")
        .select("id, order_id, fiscal_id, region, url, payload, created_at")
        .order("created_at", { ascending: false })
        .limit(25);

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []).map((row) => mapReceiptRow(row as Record<string, unknown>));
    },
    refetchInterval: 30_000,
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("receipts/process_queue", {
        body: {},
        headers: sessionHeaders,
      });
      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: async () => {
      toast({
        title: "Queue run complete",
        description: "Checked for new fiscal receipts.",
      });
      await query.refetch();
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Queue run failed",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const hasReceipts = (query.data?.length ?? 0) > 0;

  const renderTimestamp = useCallback((timestamp: string | null) => {
    if (!timestamp) return "--";
    try {
      return format(new Date(timestamp), "PPpp");
    } catch (_error) {
      return timestamp;
    }
  }, []);

  const regionLabelFor = useCallback((region: string) => {
    return region?.toUpperCase() === "RW" ? "Rwanda EBM" : "Malta Fiscal";
  }, []);

  return useMemo(
    () => ({
      receipts: query.data ?? [],
      isLoading: query.isLoading,
      isRefetching: query.isRefetching,
      error: query.error as Error | null,
      refetch: query.refetch,
      hasReceipts,
      renderTimestamp,
      regionLabelFor,
      processNext: processMutation.mutate,
      isProcessing: processMutation.isPending,
    }),
    [
      hasReceipts,
      processMutation.isPending,
      processMutation.mutate,
      query.data,
      query.error,
      query.isLoading,
      query.isRefetching,
      query.refetch,
      regionLabelFor,
      renderTimestamp,
    ],
  );
};
