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

export const InventoryHoldInput = z.object({
  supplier_hotel_id: z.string().min(1),
  plan_id: z.string().min(1),
  check_in: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u, "invalid_date"),
  check_out: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u, "invalid_date"),
  pax: z.object({
    adults: z.number().int().min(1),
    children: z.number().int().min(0).default(0),
  }),
  idempotency_key: z.string().min(1),
});

export type InventoryHoldInput = z.infer<typeof InventoryHoldInput>;

export const InventoryHoldResult = z.object({
  ok: z.boolean(),
  hold_ref: z.string().optional(),
  expires_at: z.string().optional(),
  request_id: z.string().optional(),
  source: z.string().optional(),
  idempotency_key: z.string().optional(),
});

export type InventoryHoldResult = z.infer<typeof InventoryHoldResult>;
