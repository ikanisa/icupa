import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MerchantLocation } from "@/hooks/useMerchantLocations";

export interface OutstandingPayment {
  paymentId: string;
  orderId: string;
  tenantId: string;
  locationId: string;
  tableId: string | null;
  tableCode: string | null;
  tableState: string | null;
  orderStatus: string;
  paymentStatus: string;
  method: string;
  amountCents: number;
  totalCents: number;
  currency: string;
  failureReason: string | null;
  providerRef: string | null;
  createdAt: string | null;
  capturedAt: string | null;
  capturedBy: string | null;
  capturedNotes: string | null;
}

interface ManualCapturePayload {
  paymentId: string;
  captureAmountCents?: number;
  providerRef?: string;
  notes?: string;
}

interface ManualCaptureResponse {
  data?: {
    payment_id: string;
    order_id: string;
    captured_at?: string | null;
    captured_by?: string | null;
    captured_notes?: string | null;
  };
  error?: { message?: string };
}

function mapRow(row: Record<string, any>): OutstandingPayment {
  return {
    paymentId: String(row.payment_id ?? ""),
    orderId: String(row.order_id ?? ""),
    tenantId: String(row.tenant_id ?? ""),
    locationId: String(row.location_id ?? ""),
    tableId: row.table_id ? String(row.table_id) : null,
    tableCode: typeof row.table_code === "string" ? row.table_code : null,
    tableState: typeof row.table_state === "string" ? row.table_state : null,
    orderStatus: typeof row.order_status === "string" ? row.order_status : "draft",
    paymentStatus: typeof row.payment_status === "string" ? row.payment_status : "pending",
    method: typeof row.method === "string" ? row.method : "cash",
    amountCents: Number.isFinite(Number(row.amount_cents)) ? Math.floor(Number(row.amount_cents)) : 0,
    totalCents: Number.isFinite(Number(row.total_cents)) ? Math.floor(Number(row.total_cents)) : 0,
    currency: typeof row.currency === "string" ? row.currency : "EUR",
    failureReason: typeof row.failure_reason === "string" ? row.failure_reason : null,
    providerRef: typeof row.provider_ref === "string" ? row.provider_ref : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    capturedAt: typeof row.captured_at === "string" ? row.captured_at : null,
    capturedBy: typeof row.captured_by === "string" ? row.captured_by : null,
    capturedNotes: typeof row.captured_notes === "string" ? row.captured_notes : null,
  } satisfies OutstandingPayment;
}

async function fetchOutstandingPayments(location?: MerchantLocation | null): Promise<OutstandingPayment[]> {
  const params = location ? { p_location: location.id } : {};
  const { data, error } = await supabase.rpc("merchant_outstanding_payments", params);
  if (error) {
    throw error;
  }
  return (data ?? []).map((row: Record<string, any>) => mapRow(row));
}

export function useOutstandingPayments(location?: MerchantLocation | null) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["merchant", "payments", location?.id ?? "all"], [location?.id]);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchOutstandingPayments(location ?? null),
    refetchInterval: 30_000,
  });

  const capturePayment = useMutation({
    mutationFn: async (payload: ManualCapturePayload) => {
      const { data, error } = await supabase.functions.invoke<ManualCaptureResponse>(
        "payments/manual_capture",
        {
          body: {
            payment_id: payload.paymentId,
            capture_amount_cents: payload.captureAmountCents,
            provider_ref: payload.providerRef,
            notes: payload.notes,
          },
        }
      );

      if (error) {
        throw new Error(error.message ?? "Manual capture failed");
      }

      if (data?.error) {
        throw new Error(data.error.message ?? "Manual capture failed");
      }

      return data?.data ?? null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    payments: query.data ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
    capturePayment,
  };
}
