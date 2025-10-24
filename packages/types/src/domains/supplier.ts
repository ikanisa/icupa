import { z } from "zod";

export const SupplierOrderBadge = z.object({
  code: z.string(),
  label: z.string(),
  description: z.string().nullable().optional(),
});

export const SupplierOrderRecord = z.object({
  id: z.string(),
  itinerary: z.string(),
  start_date: z.string(),
  travelers: z.number(),
  status: z.string(),
  total_cents: z.number(),
  currency: z.string(),
  notes: z.string().optional().nullable(),
  badges: z.array(SupplierOrderBadge).optional(),
});

export const SupplierOrdersRequest = z.object({
  include_badges: z.boolean().default(false),
});

export const SupplierOrdersResponse = z.object({
  ok: z.boolean(),
  supplier: z.string(),
  orders: z.array(SupplierOrderRecord).default([]),
  request_id: z.string().optional(),
  badges_included: z.boolean().optional(),
});

export const SupplierConfirmInput = z.object({
  order_id: z.string(),
  status: z.string().default("confirmed"),
  note: z.string().optional(),
});

export const SupplierConfirmResponse = z.object({
  ok: z.boolean(),
  order_id: z.string().optional(),
  status: z.string().optional(),
  request_id: z.string().optional(),
  message: z.string().optional(),
});

export type SupplierOrderBadge = z.infer<typeof SupplierOrderBadge>;
export type SupplierOrderRecord = z.infer<typeof SupplierOrderRecord>;
export type SupplierOrdersRequest = z.infer<typeof SupplierOrdersRequest>;
export type SupplierOrdersResponse = z.infer<typeof SupplierOrdersResponse>;
export type SupplierConfirmInput = z.infer<typeof SupplierConfirmInput>;
export type SupplierConfirmResponse = z.infer<typeof SupplierConfirmResponse>;
