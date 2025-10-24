import { z } from "zod";

export const InvoiceGenerateInput = z.object({
  kind: z.enum(["invoice", "credit_note"]),
  payment_id: z.string().uuid(),
  itinerary_id: z.string().uuid().optional(),
});

export type InvoiceGenerateInput = z.infer<typeof InvoiceGenerateInput>;

const PriceBreakdownTone = z.enum([
  "emerald",
  "sky",
  "amber",
  "rose",
  "lime",
  "indigo",
  "slate",
]);

export const PriceBreakdownSegment = z.object({
  id: z.string(),
  label: z.string(),
  amount_cents: z.number().int().nonnegative(),
  category: z.enum(["base", "tax", "fee", "sustainability", "discount", "insurance", "other"]).default("base"),
  description: z.string().optional(),
  tone: PriceBreakdownTone.optional(),
});

export const PriceBreakdownBadge = z.object({
  id: z.string(),
  label: z.string(),
  tone: z.enum(["neutral", "info", "success", "warning", "danger"]).default("neutral"),
  description: z.string().optional(),
});

export const PriceBreakdown = z.object({
  currency: z.string().min(1),
  total_amount_cents: z.number().int().nonnegative(),
  segments: z.array(PriceBreakdownSegment).min(1),
  badges: z.array(PriceBreakdownBadge).default([]),
  notes: z.array(z.string()).default([]),
  collected_amount_cents: z.number().int().nonnegative().optional(),
  updated_at: z.string().datetime({ offset: true }).optional(),
});

export const PriceBreakdownRequest = z.object({
  option_ids: z.array(z.string().min(1)).min(1),
  currency: z.string().min(1).optional(),
});

export const PriceBreakdownEntry = z.object({
  option_id: z.string().min(1),
  breakdown: PriceBreakdown,
});

export const PriceBreakdownResponse = z.object({
  ok: z.boolean(),
  rate: z.number().positive().optional(),
  provider: z.string().optional(),
  converted_cents: z.number().int().nonnegative().optional(),
  base_currency: z.string().optional(),
  quote_currency: z.string().optional(),
  request_id: z.string().optional(),
  source: z.enum(["fixture", "live"]).optional(),
  breakdowns: z.array(PriceBreakdownEntry).default([]),
  missing: z.array(z.string()).default([]),
});

export type PriceBreakdownSegment = z.infer<typeof PriceBreakdownSegment>;
export type PriceBreakdownBadge = z.infer<typeof PriceBreakdownBadge>;
export type PriceBreakdown = z.infer<typeof PriceBreakdown>;
export type PriceBreakdownRequest = z.infer<typeof PriceBreakdownRequest>;
export type PriceBreakdownEntry = z.infer<typeof PriceBreakdownEntry>;
export type PriceBreakdownResponse = z.infer<typeof PriceBreakdownResponse>;

export const FxRateQuoteInput = z.object({
  base_currency: z.string().min(1),
  quote_currency: z.string().min(1),
  amount_cents: z.number().int().nonnegative(),
  itinerary_id: z.string().uuid().optional(),
  booking_id: z.string().optional(),
  context: z.record(z.any()).optional(),
});

export type FxRateQuoteInput = z.infer<typeof FxRateQuoteInput>;

export const FxRateQuoteResult = z.object({
  ok: z.boolean(),
  rate: z.number().positive().optional(),
  provider: z.string().optional(),
  converted_cents: z.number().int().nonnegative().optional(),
  base_currency: z.string().optional(),
  quote_currency: z.string().optional(),
  request_id: z.string().optional(),
  source: z.enum(["fixture", "live", "cache"]).optional(),
  quoted_at: z.string().optional(),
});

export type FxRateQuoteResult = z.infer<typeof FxRateQuoteResult>;
