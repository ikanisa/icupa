export const defaultFeatureFlags = Object.freeze({
  /**
   * planner_v2_enabled_pct controls what percentage of requests should render Planner v2 surfaces.
   * It can be overridden at runtime by Supabase config or environment-derived payloads.
   */
  planner_v2_enabled_pct: 45,
});

function parsePercentage(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampPercentage(value);
  }

  if (typeof value === "string") {
    const numeric = Number.parseFloat(value);
    if (Number.isFinite(numeric)) {
      return clampPercentage(numeric);
    }
  }

  return clampPercentage(fallback);
}

function clampPercentage(value) {
  return Math.min(100, Math.max(0, value));
}

function normalizeBucket(bucket) {
  if (typeof bucket === "number" && Number.isFinite(bucket)) {
    return Math.min(0.999999, Math.max(0, bucket));
  }
  return Math.random();
}

export function evaluatePercentageFlag(value, { bucket, fallback = 0 } = {}) {
  const threshold = parsePercentage(value, fallback);
  const normalizedBucket = normalizeBucket(bucket);
  const enabled = normalizedBucket * 100 < threshold;

  return { enabled, threshold, bucket: normalizedBucket };
}

export function shouldEnablePlannerV2({ config = defaultFeatureFlags, bucket, fallbackPct = 0 } = {}) {
  const threshold = config?.planner_v2_enabled_pct;
  return evaluatePercentageFlag(threshold, { bucket, fallback: fallbackPct });
}
