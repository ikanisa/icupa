export const AUTONOMY_LEVELS = ["L0", "L1", "L2", "L3", "L4", "L5"] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export const AUTONOMY_CATEGORIES = [
  "planner",
  "concierge",
  "support",
  "ops",
  "marketing",
] as const;
export type AutonomyCategory = (typeof AUTONOMY_CATEGORIES)[number];

export const COMPOSER_DIALS = [
  "observe",
  "assist",
  "co_create",
  "delegate",
] as const;
export type ComposerDial = (typeof COMPOSER_DIALS)[number];

const LEVEL_RANK = new Map<AutonomyLevel, number>(
  AUTONOMY_LEVELS.map((level, index) => [level, index] as const),
);

export function rankAutonomyLevel(level: AutonomyLevel): number {
  return LEVEL_RANK.get(level) ?? 0;
}

export function isAutonomyCategory(value: unknown): value is AutonomyCategory {
  return typeof value === "string" &&
    (AUTONOMY_CATEGORIES as readonly string[]).includes(value);
}

export function isAutonomyLevel(value: unknown): value is AutonomyLevel {
  return typeof value === "string" &&
    (AUTONOMY_LEVELS as readonly string[]).includes(value);
}

export function isComposerDial(value: unknown): value is ComposerDial {
  return typeof value === "string" &&
    (COMPOSER_DIALS as readonly string[]).includes(value);
}
