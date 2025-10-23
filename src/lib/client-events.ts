export type ClientEventType = "storage_error" | "performance_metric";

export interface StorageErrorPayload {
  storage: "localStorage" | "sessionStorage";
  operation: "get" | "set" | "remove";
  key: string;
  message: string;
  quotaExceeded?: boolean;
}

export interface PerformanceMetricPayload {
  name: string;
  value: number;
  delta: number;
  rating: "good" | "needs-improvement" | "poor";
  id: string;
  navigationType?: string;
  sampleRate: number;
  timestamp: number;
}

export type ClientEventDetail =
  | { type: "storage_error"; payload: StorageErrorPayload }
  | { type: "performance_metric"; payload: PerformanceMetricPayload };

const EVENT_NAME = "icupa:client-event";

export function emitClientEvent(detail: ClientEventDetail) {
  if (typeof window === "undefined" || typeof CustomEvent === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<ClientEventDetail>(EVENT_NAME, { detail }));
}

export function subscribeToClientEvents(
  handler: (detail: ClientEventDetail) => void
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const listener = (event: Event) => {
    if (!("detail" in event)) {
      return;
    }
    const detail = (event as CustomEvent<ClientEventDetail>).detail;
    if (!detail) {
      return;
    }
    handler(detail);
  };

  window.addEventListener(EVENT_NAME, listener as EventListener);
  return () => window.removeEventListener(EVENT_NAME, listener as EventListener);
}
