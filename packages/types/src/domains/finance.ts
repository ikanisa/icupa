import { z } from "zod";

export const InvoiceGenerateInput = z.object({
  kind: z.enum(["invoice", "credit_note"]),
  payment_id: z.string().uuid(),
  itinerary_id: z.string().uuid().optional(),
});

export type InvoiceGenerateInput = z.infer<typeof InvoiceGenerateInput>;

export const FxRateQuoteInput = z.object({
  base_currency: z.string().length(3).transform((value) => value.toUpperCase()),
  quote_currency: z.string().length(3).transform((value) => value.toUpperCase()),
  amount_cents: z.number().int().positive(),
  invoice_id: z.string().uuid().optional(),
  request_key: z.string().min(6).max(128).optional(),
});

export const FxRateQuoteResult = z.object({
  ok: z.boolean(),
  rate: z.number().positive().optional(),
  provider: z.string().optional(),
  converted_cents: z.number().int().nonnegative().optional(),
  base_currency: z.string().optional(),
  quote_currency: z.string().optional(),
  request_id: z.string().optional(),
  snapshot_id: z.string().uuid().optional(),
});

export type FxRateQuoteInput = z.infer<typeof FxRateQuoteInput>;
export type FxRateQuoteResult = z.infer<typeof FxRateQuoteResult>;
