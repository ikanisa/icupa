import { z } from "zod";

import { CurrencyCode } from "./shared";

const Uuid = z.string().uuid({ message: "invalid_uuid" });
const IsoDateTime = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
  }, { message: "invalid_datetime" });

export const ItineraryAssemblyItem = z.object({
  itemType: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .refine((value) => ["hotel", "tour", "transfer", "permit", "other"].includes(value), {
      message: "unsupported_item_type",
    }),
  supplierRef: z.string().trim().optional(),
  startAt: IsoDateTime.optional(),
  endAt: IsoDateTime.optional(),
  priceCents: z.number().int().min(0),
  currency: CurrencyCode.optional(),
  pax: z.array(z.record(z.any())).optional(),
});

export const ItineraryAssemblyInput = z.object({
  userId: Uuid,
  currency: CurrencyCode.optional(),
  notes: z.string().trim().max(2000).optional(),
  items: z.array(ItineraryAssemblyItem).min(1),
});

export const ItineraryAssemblyResult = z.object({
  itinerary_id: Uuid,
  item_ids: z.array(Uuid),
  currency: z.string().min(3),
  total_cents: z.number().int(),
});

export const ItineraryAssemblyResponse = z.object({
  ok: z.boolean(),
  request_id: z.string(),
  result: ItineraryAssemblyResult,
});

export const SupplierMatchInput = z
  .object({
    travelerId: Uuid.optional(),
    embedding: z.array(z.number()).min(1).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .refine((value) => Boolean(value.travelerId) || Boolean(value.embedding), {
    message: "embedding_or_traveler_required",
  });

const SupplierMatchRow = z.object({
  supplier_id: Uuid.nullable().optional(),
  supplier_name: z.string().nullable().optional(),
  score: z.number(),
  metadata: z.record(z.any()).optional(),
});

const TravelerMatchRow = z.object({
  traveler_id: Uuid.nullable().optional(),
  score: z.number(),
  metadata: z.record(z.any()).optional(),
});

export const SupplierMatchResponse = z.object({
  ok: z.boolean(),
  request_id: z.string(),
  source: z.enum(["embedding", "traveler"]),
  suppliers: z.array(SupplierMatchRow),
  travelers: z.array(TravelerMatchRow),
});

export const ReservationHandleInput = z.object({
  itineraryId: Uuid,
  itemId: Uuid.optional(),
  supplierRef: z.string().trim().optional(),
  supplierId: Uuid.optional(),
  confirmationCode: z.string().trim().optional(),
  status: z.enum(["pending", "confirmed", "cancelled", "failed"]).optional(),
  metadata: z.record(z.any()).optional(),
});

export const ReservationHandleResponse = z.object({
  ok: z.boolean(),
  request_id: z.string(),
  reservation_id: Uuid.nullable().optional(),
  status: z.enum(["pending", "confirmed", "cancelled", "failed"]),
});

export type ItineraryAssemblyInput = z.infer<typeof ItineraryAssemblyInput>;
export type ItineraryAssemblyItem = z.infer<typeof ItineraryAssemblyItem>;
export type ItineraryAssemblyResult = z.infer<typeof ItineraryAssemblyResult>;
export type ItineraryAssemblyResponse = z.infer<typeof ItineraryAssemblyResponse>;
export type SupplierMatchInput = z.infer<typeof SupplierMatchInput>;
export type SupplierMatchResponse = z.infer<typeof SupplierMatchResponse>;
export type ReservationHandleInput = z.infer<typeof ReservationHandleInput>;
export type ReservationHandleResponse = z.infer<typeof ReservationHandleResponse>;
