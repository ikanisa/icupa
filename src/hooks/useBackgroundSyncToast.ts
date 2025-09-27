import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

const SYNC_COMPLETE_MESSAGE = "icupa-sync-complete";

interface SyncMessagePayload {
  type?: unknown;
  replayedCount?: unknown;
  failedCount?: unknown;
  latencyMs?: unknown;
  batchId?: unknown;
  queueStartedAt?: unknown;
  replayCompletedAt?: unknown;
}

interface UseBackgroundSyncToastOptions {
  tableSessionId?: string | null;
  locationId?: string | null;
}

export function useBackgroundSyncToast(options?: UseBackgroundSyncToastOptions): void {
  const lastToastAtRef = useRef<number>(0);
  const processedBatchIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const handleMessage = (event: MessageEvent<SyncMessagePayload>) => {
      const payload = event.data;
      if (!payload || typeof payload !== "object") {
        return;
      }
      if (payload.type !== SYNC_COMPLETE_MESSAGE) {
        return;
      }

      const replayedCount =
        typeof payload.replayedCount === "number" && Number.isFinite(payload.replayedCount)
          ? Math.max(0, Math.round(payload.replayedCount))
          : 0;

      const failedCount =
        typeof payload.failedCount === "number" && Number.isFinite(payload.failedCount)
          ? Math.max(0, Math.round(payload.failedCount))
          : 0;

      const latencyMs =
        typeof payload.latencyMs === "number" && Number.isFinite(payload.latencyMs)
          ? Math.max(0, Math.round(payload.latencyMs))
          : null;

      const batchId =
        typeof payload.batchId === "string" && payload.batchId.length > 0 ? payload.batchId : null;

      const queueStartedAt =
        typeof payload.queueStartedAt === "string" && payload.queueStartedAt.length > 0
          ? payload.queueStartedAt
          : null;

      const replayCompletedAt =
        typeof payload.replayCompletedAt === "string" && payload.replayCompletedAt.length > 0
          ? payload.replayCompletedAt
          : new Date().toISOString();

      if (replayedCount <= 0) {
        if (failedCount <= 0) {
          return;
        }
      }

      const now = Date.now();
      if (now - lastToastAtRef.current < 750) {
        return;
      }
      lastToastAtRef.current = now;

      toast({
        title: failedCount > 0 ? "Offline updates partially delivered" : "Offline updates delivered",
        description:
          failedCount > 0
            ? `We sent ${replayedCount} update${replayedCount === 1 ? "" : "s"} but ${failedCount} still need attention.`
            : replayedCount === 1
              ? "We sent your pending update once the connection returned."
              : `We sent ${replayedCount} pending updates once the connection returned.`,
      });

      if (batchId) {
        const processed = processedBatchIdsRef.current;
        if (!processed.has(batchId)) {
          processed.add(batchId);
          if (processed.size > 32) {
            const [first] = processed.values();
            processed.delete(first);
          }

          const tableSessionId = options?.tableSessionId ?? null;
          const locationId = options?.locationId ?? null;
          const locale = typeof navigator !== "undefined" ? navigator.language : null;
          const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : null;

          void (async () => {
            try {
              await supabase.from("offline_sync_events").insert({
                batch_id: batchId,
                table_session_id: tableSessionId ?? null,
                location_id: locationId ?? null,
                replayed_count: replayedCount,
                failed_count: failedCount,
                latency_ms: latencyMs,
                queue_started_at: queueStartedAt,
                replay_completed_at: replayCompletedAt,
                locale,
                user_agent: userAgent,
              });
            } catch (persistError) {
              console.error("Failed to record offline sync telemetry", persistError);
            }
          })();
        }
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [options?.locationId ?? null, options?.tableSessionId ?? null]);
}
