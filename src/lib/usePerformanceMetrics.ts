import { useEffect } from "react";
import {
  onCLS,
  onFCP,
  onFID,
  onINP,
  onLCP,
  onTTFB,
  type Metric,
} from "web-vitals";
import { emitClientEvent } from "@/lib/client-events";

export interface PerformanceMetricsOptions {
  /**
   * Sample rate between 0 and 1. Defaults to always reporting.
   */
  sampleRate?: number;
  /**
   * Optional endpoint to post metrics to. Uses `navigator.sendBeacon` when possible.
   */
  endpoint?: string;
  /**
   * Hook invoked after a metric is captured.
   */
  onReport?: (metric: ReportableMetric) => void;
}

export interface ReportableMetric {
  name: Metric["name"];
  value: number;
  delta: number;
  rating: Metric["rating"];
  id: string;
  navigationType?: Metric["navigationType"];
  sampleRate: number;
  timestamp: number;
}

function postMetric(endpoint: string, metric: ReportableMetric) {
  if (typeof navigator === "undefined") {
    return;
  }

  try {
    const body = JSON.stringify(metric);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(endpoint, blob);
      return;
    }

    void fetch(endpoint, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
    });
  } catch (error) {
    console.debug("Skipped sending performance metric", error);
  }
}

function toReport(metric: Metric, sampleRate: number): ReportableMetric {
  return {
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    rating: metric.rating,
    id: metric.id,
    navigationType: metric.navigationType,
    sampleRate,
    timestamp: Date.now(),
  };
}

/**
 * Captures Web Vitals and dispatches them via {@link emitClientEvent}.
 */
export function usePerformanceMetrics(options?: PerformanceMetricsOptions): void {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const sampleRate = Math.min(1, Math.max(0, options?.sampleRate ?? 1));
    const shouldSample = sampleRate === 1 || Math.random() < sampleRate;

    if (!shouldSample) {
      return;
    }

    const report = (metric: Metric) => {
      const payload = toReport(metric, sampleRate);
      emitClientEvent({ type: "performance_metric", payload });

      if (options?.endpoint) {
        postMetric(options.endpoint, payload);
      }

      options?.onReport?.(payload);
    };

    onCLS(report, { reportAllChanges: true });
    onFCP(report);
    onFID(report);
    onINP(report);
    onLCP(report, { reportAllChanges: true });
    onTTFB(report);
  }, [options?.endpoint, options?.onReport, options?.sampleRate]);
}

