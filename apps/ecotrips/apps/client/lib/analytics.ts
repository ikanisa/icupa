const QUEUE_KEY = "__ecotripsEventQueue" as const;

type EventDetail = Record<string, unknown> | undefined;

type EventEntry = {
  event: string;
  detail?: EventDetail;
  timestamp: string;
};

export function captureClientEvent(event: string, detail?: EventDetail) {
  if (typeof window === "undefined") return;
  const entry: EventEntry = { event, detail, timestamp: new Date().toISOString() };

  const globalWindow = window as typeof window & { [QUEUE_KEY]?: EventEntry[] };
  if (!Array.isArray(globalWindow[QUEUE_KEY])) {
    globalWindow[QUEUE_KEY] = [];
  }
  globalWindow[QUEUE_KEY]!.push(entry);

  try {
    console.info("analytics.event", entry);
  } catch (_error) {
    // console unavailable
  }

  try {
    window.dispatchEvent(new CustomEvent("ecotrips:event", { detail: entry }));
  } catch (_error) {
    // event dispatch best-effort
  }
}
