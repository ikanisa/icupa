import { z } from "zod";

const IataCode = z
  .string()
  .trim()
  .toUpperCase()
  .refine((value) => /^[A-Z]{3}$/.test(value), { message: "invalid_iata_code" });

const IsoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "invalid_date" });

const CurrencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .refine((value) => /^[A-Z]{3}$/.test(value), { message: "invalid_currency" });

export const TravelAirSearchInput = z.object({
  origin: IataCode,
  destination: IataCode,
  departureDate: IsoDate,
  returnDate: IsoDate.optional(),
  adults: z.number().int().min(1).default(1),
  children: z.number().int().min(0).default(0),
  currency: CurrencyCode.default("USD"),
});

export type TravelAirSearchInput = z.infer<typeof TravelAirSearchInput>;

export const TravelAirHoldInput = z.object({
  offerId: z.string().min(1),
  origin: IataCode,
  destination: IataCode,
  departureDate: IsoDate,
  returnDate: IsoDate.optional(),
  currency: CurrencyCode.default("USD"),
  idempotencyKey: z.string().min(4),
  contact: z.string().optional(),
});

export type TravelAirHoldInput = z.infer<typeof TravelAirHoldInput>;

export const TravelStaySearchInput = z.object({
  city: z.string().min(2),
  checkIn: IsoDate,
  checkOut: IsoDate,
  adults: z.number().int().min(1).default(1),
  children: z.number().int().min(0).default(0),
  currency: CurrencyCode.default("USD"),
});

export type TravelStaySearchInput = z.infer<typeof TravelStaySearchInput>;

export const TravelStayQuoteInput = z.object({
  propertyId: z.string().min(1),
  planCode: z.string().min(1),
  checkIn: IsoDate,
  checkOut: IsoDate,
  adults: z.number().int().min(1).default(1),
  children: z.number().int().min(0).default(0),
  currency: CurrencyCode.default("USD"),
});

export type TravelStayQuoteInput = z.infer<typeof TravelStayQuoteInput>;

export const TravelAirPriceWatchInput = z.object({
  origin: IataCode,
  destination: IataCode,
  departureDate: IsoDate,
  returnDate: IsoDate.optional(),
  currency: CurrencyCode.default("USD"),
  targetPriceCents: z.number().int().positive().optional(),
  targetPrice: z.number().positive().optional(),
  contact: z.string().optional(),
  channel: z.string().optional(),
  notes: z.string().optional(),
});

export type TravelAirPriceWatchInput = z.infer<typeof TravelAirPriceWatchInput>;
