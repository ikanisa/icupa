import { z } from "zod";

export const AUTONOMY_CATEGORY_VALUES = [
  "planner",
  "concierge",
  "support",
  "ops",
  "marketing",
] as const;

export const AUTONOMY_LEVEL_VALUES = [
  "L0",
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
] as const;

export const COMPOSER_DIAL_VALUES = [
  "observe",
  "assist",
  "co_create",
  "delegate",
] as const;

export const AutonomyCategoryEnum = z.enum(AUTONOMY_CATEGORY_VALUES);
export const AutonomyLevelEnum = z.enum(AUTONOMY_LEVEL_VALUES);
export const ComposerDialEnum = z.enum(COMPOSER_DIAL_VALUES);

export const AutonomyPreferenceInput = z.object({
  category: AutonomyCategoryEnum,
  level: AutonomyLevelEnum,
  composer: ComposerDialEnum,
});

export type AutonomyPreferenceInput = z.infer<typeof AutonomyPreferenceInput>;

export const AutonomyPreference = AutonomyPreferenceInput.extend({
  updatedAt: z.string().datetime().optional(),
  source: z.enum(["db", "fixtures", "default"]).optional(),
});

export type AutonomyPreference = z.infer<typeof AutonomyPreference>;

export const AutonomyPreferencesUpsertInput = z.object({
  preferences: z.array(AutonomyPreferenceInput).max(20).default([]),
  userId: z.string().uuid().optional(),
});

export type AutonomyPreferencesUpsertInput = z.infer<
  typeof AutonomyPreferencesUpsertInput
>;

export const AutonomyPreferencesResponse = z.object({
  ok: z.boolean(),
  preferences: z.array(AutonomyPreference),
  source: z.enum(["db", "fixtures", "default"]).optional(),
});

export type AutonomyPreferencesResponse = z.infer<
  typeof AutonomyPreferencesResponse
>;
