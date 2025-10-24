"use client";

import { useCallback, useRef } from "react";

const ANALYTICS_ENDPOINT = "/functions/v1/analytics-capture";

type AnalyticsPayload = Record<string, unknown>;

type TrackFn = (event: string, payload?: AnalyticsPayload) => void;

export function useAnalytics(): { track: TrackFn } {
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const track = useCallback<TrackFn>((event, payload = {}) => {
    queueRef.current = queueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const body = JSON.stringify({
            event,
            payload,
            session_id: typeof window !== "undefined"
              ? sessionStorage.getItem("ecotrips_session") ?? undefined
              : undefined,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
            referrer: typeof document !== "undefined" ? document.referrer : undefined,
          });
          if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
            navigator.sendBeacon(ANALYTICS_ENDPOINT, body);
            return;
          }
          await fetch(ANALYTICS_ENDPOINT, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
          });
        } catch (error) {
          console.warn("analytics track failed", error);
        }
      });
  }, []);

  return { track };
}
