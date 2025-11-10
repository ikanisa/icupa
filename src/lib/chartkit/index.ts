import { formatCurrency } from "@/lib/currency";

export interface TimeSeriesPoint {
  timestamp: string;
  window: string;
  value: number;
  label: string;
  formatted: string;
}

export interface TrendSummary {
  latest: number;
  previous: number | null;
  delta: number | null;
  trend: "up" | "down" | "flat";
}

export interface BuildSeriesOptions {
  currency?: "RWF" | "EUR";
  locale?: string;
  format?: (value: number) => string;
}

export function buildCurrencyFormatter(currency: "RWF" | "EUR", locale: string) {
  return (value: number) => formatCurrency(Math.round(value * 100), currency, locale);
}

export function buildTimeSeries(
  points: Array<{ capturedAt: string; timeWindow: string; value: number }>,
  options: BuildSeriesOptions = {},
): TimeSeriesPoint[] {
  const { currency, locale, format } = options;
  const formatter =
    format ??
    (currency && locale
      ? (value: number) => buildCurrencyFormatter(currency, locale)(value)
      : (value: number) => value.toLocaleString());

  return points
    .slice()
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())
    .map(({ capturedAt, timeWindow, value }) => ({
      timestamp: capturedAt,
      window: timeWindow,
      value,
      label: `${timeWindow} • ${new Date(capturedAt).toLocaleDateString()}`,
      formatted: formatter(value),
    }));
}

export function summariseTrend(values: number[]): TrendSummary {
  if (values.length === 0) {
    return { latest: 0, previous: null, delta: null, trend: "flat" };
  }

  const latest = values[values.length - 1];
  const previous = values.length > 1 ? values[values.length - 2] : null;

  if (previous === null) {
    return { latest, previous, delta: null, trend: "flat" };
  }

  if (previous === 0) {
    return { latest, previous, delta: latest, trend: latest === 0 ? "flat" : "up" };
  }

  const delta = (latest - previous) / previous;
  const trend = delta > 0.02 ? "up" : delta < -0.02 ? "down" : "flat";

  return { latest, previous, delta, trend };
}

export function normalisePercentage(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Number(value)));
}

export interface PerformanceScoreConfig {
  successRate: number;
  toolRate: number;
  avgLatencyMs: number;
}

export function computePerformanceScore(config: PerformanceScoreConfig): number {
  const success = normalisePercentage(config.successRate);
  const tool = normalisePercentage(config.toolRate);
  const latency = Math.max(0, config.avgLatencyMs);

  const latencyScore = latency <= 1000 ? 100 : Math.max(10, 100 - (latency - 1000) / 40);

  const weighted = success * 0.5 + tool * 0.3 + latencyScore * 0.2;
  return Math.round(Math.min(100, Math.max(0, weighted)));
}
