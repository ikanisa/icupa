import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInMinutes, differenceInSeconds } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { MerchantLocation } from "@/hooks/useMerchantLocations";

export type OrderStatus = "submitted" | "in_kitchen" | "ready" | "served" | "settled" | "voided";

export interface KdsOrderItem {
  id: string;
  name: string;
  quantity: number;
  allergens: string[];
}

export interface KdsOrder {
  id: string;
  tableId: string | null;
  tableCode: string;
  status: OrderStatus;
  createdAt: string;
  totalCents: number;
  prepSeconds: number;
  items: KdsOrderItem[];
}

const ACTIVE_STATUSES: OrderStatus[] = ["submitted", "in_kitchen", "ready"];

interface RawOrderRow {
  id: string;
  status: OrderStatus;
  created_at: string;
  table_id: string | null;
  location_id?: string | null;
  total_cents: number | null;
  tables?: { code: string | null } | null;
  order_items: { id: string; quantity: number | null; item?: { name: string | null; allergens: string[] | null } | null }[];
}

async function fetchOrders(locationId?: string): Promise<KdsOrder[]> {
  let query = supabase
    .from("orders")
    .select<RawOrderRow>(
      "id, status, created_at, table_id, total_cents, tables:tables!orders_table_id_fkey(code), order_items(id, quantity, item:items(name, allergens)))"
    )
    .in("status", ACTIVE_STATUSES)
    .order("created_at", { ascending: true });

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const now = new Date();
  return (data ?? []).map((row) => {
    const createdAt = row.created_at ?? now.toISOString();
    const prepSeconds = Math.max(0, differenceInSeconds(now, new Date(createdAt)));
    return {
      id: row.id,
      tableId: row.table_id ?? null,
      tableCode: row.tables?.code ?? "--",
      status: row.status,
      createdAt,
      totalCents: row.total_cents ?? 0,
      prepSeconds,
      items: (row.order_items ?? []).map((orderItem) => ({
        id: orderItem.id,
        name: orderItem.item?.name ?? "Unlabelled item",
        quantity: orderItem.quantity ?? 1,
        allergens: orderItem.item?.allergens ?? [],
      })),
    } satisfies KdsOrder;
  });
}

const TABLE_STATE_BY_STATUS: Record<OrderStatus, "ordering" | "in_kitchen" | "served" | "bill" | undefined> = {
  submitted: "ordering",
  in_kitchen: "in_kitchen",
  ready: "served",
  served: "bill",
  settled: undefined,
  voided: undefined,
};

export function useKdsOrders(location?: MerchantLocation | null) {
  const locationId = location?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["merchant", "kds", locationId ?? "all"],
    queryFn: () => fetchOrders(locationId),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`merchant-kds-${locationId ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          const next = payload.new as RawOrderRow | null;
          const previous = payload.old as RawOrderRow | null;
          const nextStatus = next?.status ?? previous?.status;
          if (!nextStatus || (!ACTIVE_STATUSES.includes(nextStatus) && !ACTIVE_STATUSES.includes(previous?.status as OrderStatus))) {
            return;
          }

          queryClient.setQueryData<KdsOrder[]>(["merchant", "kds", locationId ?? "all"], (existing) => {
            const current = existing ?? [];
            if (!next) {
              return current.filter((item) => item.id !== previous?.id);
            }

            if (locationId && next && "location_id" in next && next.location_id !== locationId) {
              return current;
            }

            const parsed = {
              id: next.id,
              tableId: next.table_id ?? null,
              tableCode: next.tables?.code ?? previous?.tables?.code ?? "--",
              status: next.status,
              createdAt: next.created_at ?? previous?.created_at ?? new Date().toISOString(),
              totalCents: next.total_cents ?? previous?.total_cents ?? 0,
              prepSeconds: Math.max(0, differenceInSeconds(new Date(), new Date(next.created_at ?? previous?.created_at ?? new Date().toISOString()))),
              items: (next.order_items ?? previous?.order_items ?? []).map((item) => ({
                id: item.id,
                name: item.item?.name ?? "Unlabelled item",
                quantity: item.quantity ?? 1,
                allergens: item.item?.allergens ?? [],
              })),
            } satisfies KdsOrder;

            const existingIndex = current.findIndex((item) => item.id === parsed.id);
            if (existingIndex >= 0) {
              const copy = [...current];
              copy[existingIndex] = parsed;
              return copy;
            }
            return [...current, parsed];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [locationId, queryClient]);

  const orders = useMemo(() => {
    const base = query.data ?? [];
    return base
      .map((order) => ({
        ...order,
        prepSeconds: Math.max(0, differenceInSeconds(new Date(), new Date(order.createdAt))),
      }))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [query.data]);

  const markOrderStatus = async (order: KdsOrder, nextStatus: OrderStatus) => {
    await supabase
      .from("orders")
      .update({ status: nextStatus })
      .eq("id", order.id);

    const nextTableState = TABLE_STATE_BY_STATUS[nextStatus];
    if (nextTableState && order.tableId) {
      await supabase.from("tables").update({ state: nextTableState }).eq("id", order.tableId);
      await supabase.from("table_state_events").insert({
        table_id: order.tableId,
        previous_state: TABLE_STATE_BY_STATUS[order.status] ?? null,
        next_state: nextTableState,
        notes: `Auto-sync from KDS status ${order.status} → ${nextStatus}`,
      });
    }

    queryClient.invalidateQueries({ queryKey: ["merchant", "kds", locationId ?? "all"] });
  };

  return {
    orders,
    isLoading: query.isLoading,
    refetch: query.refetch,
    markOrderStatus,
  };
}

export function formatPrepDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes <= 0) {
    return `${remainingSeconds}s`;
  }
  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
}

export function computeDelayMinutes(order: KdsOrder): number {
  return differenceInMinutes(new Date(), new Date(order.createdAt));
}
