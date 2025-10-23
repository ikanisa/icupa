import { z } from "zod";

import { LocaleEnum } from "./shared";

export const InventorySearchInput = z.object({
  destination: z.string().min(2, "destination_required"),
  startDate: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "invalid_date"),
  endDate: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "invalid_date"),
  party: z.object({
    adults: z.number().int().min(1),
    children: z.number().int().min(0).default(0),
  }),
  budgetHint: z.enum(["value", "balanced", "premium"]).optional(),
  locale: LocaleEnum.default("en"),
});

export type InventorySearchInput = z.infer<typeof InventorySearchInput>;

export const InventoryQuoteInput = z.object({
  quoteId: z.string().min(1),
  locale: LocaleEnum.default("en"),
});

export type InventoryQuoteInput = z.infer<typeof InventoryQuoteInput>;
