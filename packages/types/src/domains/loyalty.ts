import { z } from "zod";

export const LoyaltyGrantInput = z.object({
  profile_id: z.string().uuid(),
  itinerary_id: z.string().uuid().optional(),
  points: z.number().int().positive(),
  reason: z.string().min(3),
  source: z.string().min(1).default("manual"),
  request_key: z.string().min(6).max(128).optional(),
});

export const LoyaltyGrantResult = z.object({
  ok: z.boolean(),
  account_id: z.string().uuid().optional(),
  balance: z.number().int().nonnegative().optional(),
  points_awarded: z.number().int().nonnegative().optional(),
  tier: z.string().optional(),
  message: z.string().optional(),
  request_id: z.string().optional(),
});

export type LoyaltyGrantInput = z.infer<typeof LoyaltyGrantInput>;
export type LoyaltyGrantResult = z.infer<typeof LoyaltyGrantResult>;
