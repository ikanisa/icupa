import { z } from "zod";

import type { DescriptorMap } from "../types";
import {
  TravelAirHoldInput,
  TravelAirPriceWatchInput,
  TravelAirSearchInput,
  TravelStayQuoteInput,
  TravelStaySearchInput,
} from "@ecotrips/types";

const FlightSegment = z.object({
  origin: z.string(),
  destination: z.string(),
  departure_at: z.string(),
  arrival_at: z.string(),
  duration_minutes: z.number(),
  cabin: z.string(),
  fare_class: z.string(),
  carrier: z.string(),
  flight_number: z.string(),
});

const FlightOffer = z.object({
  id: z.string(),
  carrier: z.string(),
  flight_number: z.string(),
  segments: z.array(FlightSegment),
  price: z.object({
    currency: z.string(),
    base_cents: z.number(),
    taxes_cents: z.number(),
    total_cents: z.number(),
  }),
  baggage: z.record(z.any()).optional(),
  seats_remaining: z.number().optional(),
  refundable: z.boolean().optional(),
});

const StayOption = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  neighborhood: z.string().optional(),
  supplier: z.string().optional(),
  currency: z.string(),
  nightly_rate_cents: z.number(),
  total_cents: z.number(),
  check_in: z.string(),
  check_out: z.string(),
  nights: z.number(),
  amenities: z.array(z.string()),
  images: z.array(z.string()),
  rating: z.number().optional(),
  review_count: z.number().optional(),
});

const StayQuote = z.object({
  property_id: z.string(),
  plan_code: z.string(),
  currency: z.string(),
  nights: z.number(),
  check_in: z.string(),
  check_out: z.string(),
  rate: z.object({
    base_cents: z.number(),
    taxes_cents: z.number(),
    fees_cents: z.number(),
    total_cents: z.number(),
  }),
  inclusions: z.array(z.string()),
  cancellation_policy: z.string().optional(),
  pax: z.object({ adults: z.number(), children: z.number() }),
});

const CacheMeta = z.object({
  hit: z.boolean(),
  stale: z.boolean(),
  expires_at: z.string(),
});

export const travelDescriptors = {
  "travel.air.search": {
    path: "/functions/v1/providers-air-search",
    method: "POST",
    auth: "anon",
    input: TravelAirSearchInput,
    output: z.object({
      ok: z.boolean(),
      request_id: z.string(),
      source: z.string(),
      offers: z.array(FlightOffer),
      cache: CacheMeta.optional(),
    }),
    cacheTtlMs: 900_000,
  },
  "travel.air.hold": {
    path: "/functions/v1/providers-air-hold",
    method: "POST",
    auth: "anon",
    input: TravelAirHoldInput,
    output: z.object({
      ok: z.boolean(),
      request_id: z.string(),
      hold_ref: z.string(),
      expires_at: z.string(),
      source: z.string(),
      idempotency_key: z.string(),
      contact: z.string().nullable().optional(),
      currency: z.string(),
      reused: z.boolean().optional(),
    }),
    cacheTtlMs: 900_000,
  },
  "travel.stay.search": {
    path: "/functions/v1/providers-stay-search",
    method: "POST",
    auth: "anon",
    input: TravelStaySearchInput,
    output: z.object({
      ok: z.boolean(),
      request_id: z.string(),
      source: z.string(),
      properties: z.array(StayOption),
      cache: CacheMeta.optional(),
    }),
    cacheTtlMs: 900_000,
  },
  "travel.stay.quote": {
    path: "/functions/v1/providers-stay-quote",
    method: "POST",
    auth: "anon",
    input: TravelStayQuoteInput,
    output: z.object({
      ok: z.boolean(),
      request_id: z.string(),
      source: z.string(),
      quote: StayQuote,
      cache: CacheMeta.optional(),
    }),
    cacheTtlMs: 300_000,
  },
  "travel.air.priceWatch": {
    path: "/functions/v1/air-price-watch",
    method: "POST",
    auth: "anon",
    input: TravelAirPriceWatchInput,
    output: z.object({
      ok: z.boolean(),
      request_id: z.string(),
      watch_id: z.string(),
      status: z.string(),
      next_refresh_at: z.string().nullable().optional(),
    }),
  },
} satisfies DescriptorMap;
