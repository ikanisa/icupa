export type FeatureFlagConfig = {
  planner_v2_enabled_pct?: number | string | null;
  [key: string]: unknown;
};

export type PercentageFlagEvaluation = {
  enabled: boolean;
  threshold: number;
  bucket: number;
};

export interface EvaluatePercentageFlagOptions {
  bucket?: number;
  fallback?: number;
}

export declare const defaultFeatureFlags: Readonly<FeatureFlagConfig>;

export declare function evaluatePercentageFlag(
  value: number | string | null | undefined,
  options?: EvaluatePercentageFlagOptions,
): PercentageFlagEvaluation;

export interface PlannerRolloutOptions {
  config?: FeatureFlagConfig | null;
  bucket?: number;
  fallbackPct?: number;
}

export declare function shouldEnablePlannerV2(options?: PlannerRolloutOptions): PercentageFlagEvaluation;
