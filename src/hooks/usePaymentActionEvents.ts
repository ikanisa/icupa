import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PaymentActionEvent {
  id: string;
  paymentId: string;
  orderId: string;
  action: string;
  notes: string | null;
  actorId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

async function fetchPaymentActionEvents(paymentIds: string[]): Promise<Record<string, PaymentActionEvent[]>> {
  if (paymentIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from("payment_action_events")
    .select("id, payment_id, order_id, action, notes, actor_id, metadata, created_at")
    .in("payment_id", paymentIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const grouped: Record<string, PaymentActionEvent[]> = {};
  for (const row of data ?? []) {
    if (!row?.payment_id) continue;
    const key = String(row.payment_id);
    if (!grouped[key]) {
      grouped[key] = [];
    }
    const identifier = row.id
      ? String(row.id)
      : `${String(row.payment_id)}-${String(row.created_at ?? Date.now())}`;
    grouped[key].push({
      id: identifier,
      paymentId: String(row.payment_id),
      orderId: String(row.order_id ?? ""),
      action: String(row.action ?? ""),
      notes: typeof row.notes === "string" ? row.notes : null,
      actorId: typeof row.actor_id === "string" ? row.actor_id : null,
      metadata: typeof row.metadata === "object" && row.metadata !== null ? (row.metadata as Record<string, unknown>) : {},
      createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    });
  }

  return grouped;
}

export function usePaymentActionEvents(paymentIds: string[]) {
  const sortedIds = useMemo(() => [...paymentIds].sort(), [paymentIds]);
  return useQuery({
    queryKey: ["merchant", "payments", "actions", sortedIds.join(":")],
    queryFn: () => fetchPaymentActionEvents(sortedIds),
    enabled: sortedIds.length > 0,
    staleTime: 30_000,
  });
}
