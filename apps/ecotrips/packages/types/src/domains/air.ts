import { z } from "zod";

const IataCode = z
  .string()
  .regex(/^[A-Z]{3}$/u, "invalid_airport")
  .transform((value) => value.toUpperCase());

export const AirPriceWatchInput = z.object({
  origin: IataCode,
  destination: IataCode,
  departure_date: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u, "invalid_date"),
  return_date: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u, "invalid_date")
    .optional(),
  seats: z.number().int().min(1).max(9),
  cabin: z.enum(["economy", "premium_economy", "business"]),
  target_price_cents: z.number().int().positive().optional(),
  traveler_name: z.string().min(1),
  contact_email: z.string().email(),
  itinerary_id: z.string().uuid().optional(),
});

export type AirPriceWatchInput = z.infer<typeof AirPriceWatchInput>;

export const AirPriceWatchResult = z.object({
  ok: z.boolean(),
  watch_id: z.string().optional(),
  request_id: z.string().optional(),
  submitted_at: z.string().optional(),
});

export type AirPriceWatchResult = z.infer<typeof AirPriceWatchResult>;
