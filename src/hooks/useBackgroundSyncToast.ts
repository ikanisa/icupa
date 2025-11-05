import { useEffect, useRef } from "react";
import { toast } from "@icupa/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { subscribeToClientEvents } from "@/lib/client-events";

const SYNC_COMPLETE_MESSAGE = "icupa-sync-complete";

interface BackgroundSyncToastOptions {
  tenantId?: string | null;
  locationId?: string | null;
  tableSessionId?: string | null;
}

interface SyncMessagePayload {
  type?: unknown;
  replayedCount?: unknown;
  firstQueuedAt?: unknown;
  replayStartedAt?: unknown;
  replayCompletedAt?: unknown;
  queuedDurationMs?: unknown;
  replayLatencyMs?: unknown;
  hadError?: unknown;
  batchId?: unknown;
}

interface NormalizedSyncPayload {
  replayedCount: number;
  firstQueuedAtIso: string | null;
  replayStartedAtIso: string | null;
  replayCompletedAtIso: string | null;
  queuedDurationMs: number | null;
  replayLatencyMs: number | null;
  hadError: boolean;
  batchId: string | null;
}

export function useBackgroundSyncToast(options?: BackgroundSyncToastOptions): void {
  const lastToastAtRef = useRef<number>(0);
  const lastBatchIdRef = useRef<string | null>(null);
  const contextRef = useRef<BackgroundSyncToastOptions | undefined>(options);

  useEffect(() => {
    contextRef.current = options;
  }, [options]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const unsubscribe = subscribeToClientEvents((event) => {
      if (event.type !== "storage_error") {
        return;
      }
      const context = contextRef.current;
      if (!context?.tableSessionId) {
        return;
      }

      void (async () => {
        try {
          await supabase.functions.invoke("client-events-log-storage-error", {
            body: {
              table_session_id: context.tableSessionId,
              location_id: context.locationId,
              tenant_id: context.tenantId,
              key: event.payload.key,
              operation: event.payload.operation,
              message: event.payload.message,
              storage: event.payload.storage,
              quota_exceeded: event.payload.quotaExceeded ?? false,
            },
          });
        } catch (error) {
          console.error("Failed to log client storage error", error);
        }
      })();
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const logTelemetry = async (payload: NormalizedSyncPayload) => {
      const context = contextRef.current ?? {};
      if (
        !context.tenantId &&
        !context.locationId &&
        !context.tableSessionId
      ) {
        return;
      }

      if (payload.replayedCount <= 0) {
        return;
      }

      if (!context.tableSessionId) {
        return;
      }

      try {
        const { error } = await supabase.from("offline_sync_events").insert({
          tenant_id: context.tenantId ?? null,
          location_id: context.locationId ?? null,
          table_session_id: context.tableSessionId,
          replayed_count: payload.replayedCount,
          first_enqueued_at: payload.firstQueuedAtIso,
          replay_started_at: payload.replayStartedAtIso,
          replay_completed_at: payload.replayCompletedAtIso,
          queued_duration_ms: payload.queuedDurationMs,
          replay_latency_ms: payload.replayLatencyMs,
          had_error: payload.hadError,
          batch_id: payload.batchId,
          metadata: {
            source: "client",
          },
        });

        if (error) {
          const message = error.message ?? "unknown error";
          if (!message.includes("duplicate key")) {
            console.error("Failed to log offline sync telemetry", error);
          }
        }
      } catch (telemetryError) {
        console.error("Unexpected error logging offline sync telemetry", telemetryError);
      }
    };

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

      const firstQueuedAtIso =
        typeof payload.firstQueuedAt === "number"
          ? new Date(payload.firstQueuedAt).toISOString()
          : typeof payload.firstQueuedAt === "string"
          ? payload.firstQueuedAt
          : null;

      const replayStartedAtIso =
        typeof payload.replayStartedAt === "number"
          ? new Date(payload.replayStartedAt).toISOString()
          : typeof payload.replayStartedAt === "string"
          ? payload.replayStartedAt
          : null;

      const replayCompletedAtIso =
        typeof payload.replayCompletedAt === "number"
          ? new Date(payload.replayCompletedAt).toISOString()
          : typeof payload.replayCompletedAt === "string"
          ? payload.replayCompletedAt
          : null;

      let queuedDurationMs: number | null = null;
      if (typeof payload.queuedDurationMs === "number") {
        queuedDurationMs = Math.max(0, Math.round(payload.queuedDurationMs));
      } else if (firstQueuedAtIso && replayCompletedAtIso) {
        queuedDurationMs = Math.max(
          0,
          new Date(replayCompletedAtIso).getTime() - new Date(firstQueuedAtIso).getTime(),
        );
      }

      let replayLatencyMs: number | null = null;
      if (typeof payload.replayLatencyMs === "number") {
        replayLatencyMs = Math.max(0, Math.round(payload.replayLatencyMs));
      } else if (replayStartedAtIso && replayCompletedAtIso) {
        replayLatencyMs = Math.max(
          0,
          new Date(replayCompletedAtIso).getTime() - new Date(replayStartedAtIso).getTime(),
        );
      }

      const normalized: NormalizedSyncPayload = {
        replayedCount,
        firstQueuedAtIso,
        replayStartedAtIso,
        replayCompletedAtIso,
        queuedDurationMs,
        replayLatencyMs,
        hadError: payload.hadError === true,
        batchId:
          typeof payload.batchId === "string" && payload.batchId.length > 0
            ? payload.batchId
            : null,
      };

      if (replayedCount <= 0) {
        return;
      }

      if (normalized.batchId && lastBatchIdRef.current === normalized.batchId) {
        return;
      }

      lastBatchIdRef.current = normalized.batchId ?? lastBatchIdRef.current;
      void logTelemetry(normalized);

      const now = Date.now();
      if (now - lastToastAtRef.current < 750) {
        return;
      }
      lastToastAtRef.current = now;

      toast({
        title: "Offline updates delivered",
        description:
          replayedCount === 1
            ? "We sent your pending update once the connection returned."
            : `We sent ${replayedCount} pending updates once the connection returned.`,
      });
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, []);
}
