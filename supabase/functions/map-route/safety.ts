export const SAFETY_WARNING_TYPES = [
  "night_travel",
  "late_arrival_check_required",
] as const;

export type SafetyWarning = typeof SAFETY_WARNING_TYPES[number];

export interface SafetyWarningCoverage {
  warning: SafetyWarning;
  triggered: boolean;
}

export function calculateSafetyWarningCoverage(
  warnings: readonly string[],
): SafetyWarningCoverage[] {
  return SAFETY_WARNING_TYPES.map((warning) => ({
    warning,
    triggered: warnings.includes(warning),
  }));
}
