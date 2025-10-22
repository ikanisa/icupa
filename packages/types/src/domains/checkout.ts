import { z } from "zod";

import { CurrencyCode } from "./shared";

export const CheckoutInput = z.object({
  itineraryId: z.string().uuid("invalid_itinerary_id"),
  quoteId: z.string().min(1),
  amountCents: z.number().int().min(0),
  currency: CurrencyCode,
  paymentProvider: z.enum(["stripe", "momo", "revolut"]),
  idempotencyKey: z.string().min(10),
});

export type CheckoutInput = z.infer<typeof CheckoutInput>;
