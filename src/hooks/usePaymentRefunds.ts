import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withSupabaseCaching } from "@/lib/query-client";

export interface PaymentRefund {
  id: string;
  paymentId: string;
  amountCents: number | null;
  currency: string;
  status: string;
  reason: string | null;
  requestedBy: string | null;
  createdAt: string;
}

async function fetchRefunds(): Promise<PaymentRefund[]> {
  const { data, error } = await supabase
    .from('payment_refunds')
    .select('id, payment_id, amount_cents, currency, status, reason, requested_by, created_at')
    .in('status', ['pending'])
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id!,
    paymentId: row.payment_id!,
    amountCents: row.amount_cents ?? null,
    currency: row.currency ?? 'RWF',
    status: row.status ?? 'pending',
    reason: row.reason ?? null,
    requestedBy: row.requested_by ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  }));
}

export function usePaymentRefunds() {
  return useQuery({
    queryKey: ['supabase', 'admin', 'payment-refunds'],
    queryFn: fetchRefunds,
    ...withSupabaseCaching({ entity: 'payment-refunds', staleTime: 20_000 }),
  });
}

interface RefundDecisionInput {
  refundId: string;
  decision: 'approve' | 'reject' | 'void';
  amountCents?: number;
  reason?: string;
}

async function postRefundDecision(input: RefundDecisionInput) {
  const { data: session } = await supabase.auth.getSession();
  const accessToken = session.session?.access_token;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (import.meta.env.VITE_ADMIN_SERVICE_TOKEN) {
    headers['x-icupa-admin-token'] = import.meta.env.VITE_ADMIN_SERVICE_TOKEN;
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payments/refund`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: input.decision,
      refund_id: input.refundId,
      amount_cents: input.amountCents,
      reason: input.reason,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message ?? 'Failed to update refund');
  }

  return response.json();
}

export function useRefundDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postRefundDecision,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['supabase', 'admin', 'payment-refunds'] }),
  });
}
