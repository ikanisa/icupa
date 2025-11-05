import { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { z } from "zod";
import { createSupabaseDataAccess } from "@icupa/data-access";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@icupa/ui/use-toast";
import { useSupabaseSessionHeaders } from "@/modules/supabase";
import type { MerchantReceipt } from "../types";

const RECEIPTS_QUERY_KEY = ["merchant-receipts"] as const;

const receiptPayloadSchema = z
  .object({
    summary: z.record(z.any()).optional(),
    integration_notes: z.record(z.any()).optional(),
  })
  .partial()
  .passthrough()
  .nullable()
  .transform((value) => value ?? {});

const receiptRowSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((value) => String(value)),
  order_id: z.union([z.string(), z.number(), z.null()]).nullable().transform((value) => (value == null ? "" : String(value))),
  fiscal_id: z.string().nullable(),
  region: z.string().nullable(),
  url: z.string().nullable(),
  payload: receiptPayloadSchema,
  created_at: z.string().nullable(),
});

type ReceiptRow = z.infer<typeof receiptRowSchema> & {
  payload: {
    summary?: Record<string, unknown>;
    integration_notes?: Record<string, unknown>;
  };
};

const mapReceiptRow = (row: ReceiptRow): MerchantReceipt => {
  const summary = row.payload.summary ?? null;
  const integrationNotes = row.payload.integration_notes ?? null;

  return {
    id: row.id,
    orderId: row.order_id,
    fiscalId:
      typeof row.fiscal_id === "string" && row.fiscal_id.length > 0
        ? row.fiscal_id
        : typeof summary?.fiscalId === "string"
        ? (summary.fiscalId as string)
        : null,
    region:
      typeof row.region === "string" && row.region.length > 0
        ? row.region
        : typeof summary?.region === "string"
        ? (summary.region as string)
        : "",
    url:
      typeof row.url === "string" && row.url.length > 0
        ? row.url
        : typeof summary?.url === "string"
        ? (summary.url as string)
        : null,
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : typeof summary?.issuedAtIso === "string"
        ? (summary.issuedAtIso as string)
        : null,
    summary,
    integrationNotes,
  } satisfies MerchantReceipt;
};

export const useMerchantReceipts = () => {
  const sessionHeaders = useSupabaseSessionHeaders();
  const dataAccess = useMemo(() => createSupabaseDataAccess(supabase), []);

  const query = useQuery({
    queryKey: RECEIPTS_QUERY_KEY,
    queryFn: async () => {
      const rows = await dataAccess.withValidation(
        () =>
          supabase
            .from("receipts")
            .select("id, order_id, fiscal_id, region, url, payload, created_at")
            .order("created_at", { ascending: false })
            .limit(25),
        z.array(receiptRowSchema),
        { message: "Unable to load merchant receipts" },
      );

      return rows.map((row) => mapReceiptRow(row));
    },
    refetchInterval: 30_000,
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      await dataAccess.withValidation(
        () =>
          supabase.functions.invoke("receipts/process_queue", {
            body: {},
            headers: sessionHeaders,
          }),
        z.unknown(),
        { message: "Unable to process fiscal receipts" },
      );
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
