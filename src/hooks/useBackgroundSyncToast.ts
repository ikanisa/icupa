import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/use-toast";

const SYNC_COMPLETE_MESSAGE = "icupa-sync-complete";

interface SyncMessagePayload {
  type?: unknown;
  replayedCount?: unknown;
}

export function useBackgroundSyncToast(): void {
  const lastToastAtRef = useRef<number>(0);

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

      if (replayedCount <= 0) {
        return;
      }

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
