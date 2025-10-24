import { z } from "zod";

import { CurrencyCode } from "./shared";

export const PricingLineItem = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  amount_cents: z.number().int(),
});

export const PricingApplyInput = z.object({
  itinerary_id: z.string().uuid(),
  promo_code: z.string().min(3).max(64),
  base_total_cents: z.number().int().nonnegative(),
  currency: CurrencyCode,
  line_items: z.array(PricingLineItem).default([]),
  request_key: z.string().min(6).max(128).optional(),
});

export const PricingAdjustment = z.object({
  label: z.string(),
  amount_cents: z.number().int(),
  type: z.enum(["promo", "loyalty", "fees", "tax"]),
});

export const PricingApplyResult = z.object({
  ok: z.boolean(),
  promo_code: z.string().optional(),
  rule_id: z.string().uuid().optional(),
  discount_cents: z.number().int().nonnegative().optional(),
  total_after_cents: z.number().int().nonnegative().optional(),
  currency: CurrencyCode.optional(),
  adjustments: z.array(PricingAdjustment).default([]),
  loyalty_points: z.number().int().nonnegative().optional(),
  message: z.string().optional(),
  request_id: z.string().optional(),
});

export type PricingApplyInput = z.infer<typeof PricingApplyInput>;
export type PricingApplyResult = z.infer<typeof PricingApplyResult>;
export type PricingAdjustment = z.infer<typeof PricingAdjustment>;
export type PricingLineItem = z.infer<typeof PricingLineItem>;
