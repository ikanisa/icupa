import { useEffect, useRef } from "react";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";

interface UseReceiptNotificationsOptions {
  tableSessionId: string | null | undefined;
  enabled?: boolean;
}

interface ReceiptEventPayload {
  receipt_id?: string;
  order_id?: string;
  payment_id?: string;
  fiscal_id?: string;
  url?: string;
  region?: string;
}

interface ReceiptRow {
  id?: string | null;
  fiscal_id?: string | null;
  region?: string | null;
  url?: string | null;
  payload?: Record<string, unknown> | null;
}

const REGION_LABELS: Record<string, string> = {
  RW: "Rwanda EBM",
  EU: "Malta fiscal",
};

function normaliseRegion(region: string | null | undefined): string | null {
  if (!region) return null;
  const upper = region.toUpperCase();
  return upper === "RW" ? "RW" : upper === "EU" ? "EU" : null;
}

async function fetchReceiptDetails(receiptId: string): Promise<ReceiptRow | null> {
  const { data, error } = await supabase
    .from("receipts")
    .select("id, fiscal_id, region, url, payload")
    .eq("id", receiptId)
    .maybeSingle<ReceiptRow>();

  if (error) {
    console.error("Failed to load receipt details", error, { receiptId });
    return null;
  }

  if (!data) {
    return null;
  }

  const payload = (data.payload ?? {}) as Record<string, unknown>;
  const summary =
    typeof payload.summary === "object" && payload.summary !== null
      ? (payload.summary as Record<string, unknown>)
      : null;

  return {
    id: data.id ?? null,
    fiscal_id:
      typeof data.fiscal_id === "string" && data.fiscal_id.length > 0
        ? data.fiscal_id
        : typeof summary?.fiscalId === "string"
        ? (summary.fiscalId as string)
        : null,
    region:
      typeof data.region === "string" && data.region.length > 0
        ? data.region
        : typeof summary?.region === "string"
        ? (summary.region as string)
        : null,
    url:
      typeof data.url === "string" && data.url.length > 0
        ? data.url
        : typeof summary?.url === "string"
        ? (summary.url as string)
        : null,
  } satisfies ReceiptRow;
}

async function hydrateExistingReceipts(tableSessionId: string, seen: Set<string>) {
  const { data, error } = await supabase
    .from("receipts")
    .select("id, orders!inner(table_session_id)")
    .eq("orders.table_session_id", tableSessionId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Failed to hydrate existing receipts", error, { tableSessionId });
    return;
  }

  for (const row of data ?? []) {
    const id = typeof row?.id === "string" ? row.id : null;
    if (id) {
      seen.add(id);
    }
  }
}

export function useReceiptNotifications({
  tableSessionId,
  enabled = true,
}: UseReceiptNotificationsOptions): void {
  const seenReceiptsRef = useRef<Set<string>>(new Set());
  const seenEventsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    seenReceiptsRef.current.clear();
    seenEventsRef.current.clear();

    if (!enabled || !tableSessionId) {
      return;
    }

    let isActive = true;

    void hydrateExistingReceipts(tableSessionId, seenReceiptsRef.current);

    const handleEvent = async (
      payload: RealtimePostgresInsertPayload<Record<string, unknown>>,
    ) => {
      if (!isActive) {
        return;
      }

      const newRow = payload.new as Record<string, unknown>;
      const eventId = newRow?.id ? String(newRow.id) : null;
      if (eventId && seenEventsRef.current.has(eventId)) {
        return;
      }
      if (eventId) {
        seenEventsRef.current.add(eventId);
      }

      const eventType = typeof newRow?.type === "string" ? (newRow.type as string) : null;
      if (eventType !== "receipt_issued") {
        return;
      }

      const rawPayload = (newRow?.payload ?? {}) as ReceiptEventPayload;
      const receiptId = rawPayload?.receipt_id;
      if (receiptId && seenReceiptsRef.current.has(receiptId)) {
        // Receipt already surfaced in this session.
        return;
      }
      if (receiptId) {
        seenReceiptsRef.current.add(receiptId);
      }

      let fiscalId = rawPayload?.fiscal_id ?? null;
      let region = rawPayload?.region ?? null;
      let url = rawPayload?.url ?? null;

      if (receiptId && (!fiscalId || !region || !url)) {
        const receiptDetails = await fetchReceiptDetails(receiptId);
        fiscalId = receiptDetails?.fiscal_id ?? fiscalId;
        region = receiptDetails?.region ?? region;
        url = receiptDetails?.url ?? url;
      }

      const normalisedRegion = normaliseRegion(region);
      const label = normalisedRegion ? REGION_LABELS[normalisedRegion] ?? "Fiscal device" : "Fiscal device";
      const description = fiscalId
        ? `Fiscal ID ${fiscalId} issued via the ${label}.`
        : `A new ${label.toLowerCase()} receipt is ready.`;

      const openReceipt = () => {
        if (url && typeof window !== "undefined") {
          window.open(url, "_blank", "noopener");
        }
      };

      toast({
        title: "Receipt ready",
        description,
        action:
          url && typeof window !== "undefined" ? (
            <ToastAction altText="View receipt" onClick={openReceipt}>
              View
            </ToastAction>
          ) : undefined,
      });
    };

    const channel = supabase
      .channel(`receipt-events-${tableSessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "events",
          filter: `table_session_id=eq.${tableSessionId}`,
        },
        (payload) => {
          void handleEvent(payload);
        },
      );

    const subscription = channel.subscribe();
    const receiptCache = seenReceiptsRef.current;
    const eventCache = seenEventsRef.current;

    return () => {
      isActive = false;
      receiptCache.clear();
      eventCache.clear();
      supabase.removeChannel(subscription);
    };
  }, [enabled, tableSessionId]);
}
