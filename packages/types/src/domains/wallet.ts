import { z } from "zod";

import { LocaleEnum } from "./shared";

export const WalletOfflinePackInput = z.object({
  itineraryId: z.string().uuid(),
  locale: LocaleEnum.default("en"),
});

export type WalletOfflinePackInput = z.infer<typeof WalletOfflinePackInput>;

export const ConciergeDailyBriefSegment = z.object({
  id: z.string(),
  time_window: z.string(),
  title: z.string(),
  instruction: z.string(),
  contact: z
    .object({
      name: z.string(),
      role: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  notes: z.array(z.string()).default([]),
  map_link: z.string().url().optional(),
  safety_note: z.string().optional(),
});

export const ConciergeDailyBriefAlert = z.object({
  id: z.string(),
  type: z.string(),
  message: z.string(),
  severity: z.string().default("info"),
});

export const ConciergeDailyBriefSavings = z.object({
  escrow_id: z.string(),
  target_cents: z.number().int().nonnegative(),
  collected_cents: z.number().int().nonnegative(),
  due_date: z.string(),
  nudge_copy: z.string(),
  next_step: z.string().optional(),
});

export const ConciergeDailyBrief = z.object({
  day: z.number().int().positive(),
  date: z.string(),
  headline: z.string(),
  summary: z.string(),
  segments: z.array(ConciergeDailyBriefSegment).default([]),
  alerts: z.array(ConciergeDailyBriefAlert).default([]),
  group_savings: ConciergeDailyBriefSavings.optional(),
});

export const ConciergeDailyBriefQuery = z
  .object({
    itineraryId: z.string().uuid().optional(),
    day: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(7).optional(),
    locale: LocaleEnum.default("en"),
  })
  .partial()
  .default({});

export const ConciergeDailyBriefResponse = z.object({
  ok: z.boolean(),
  request_id: z.string().optional(),
  source: z.string().optional(),
  itinerary_id: z.string().optional(),
  traveler_names: z.array(z.string()).default([]),
  timezone: z.string().optional(),
  briefs: z.array(ConciergeDailyBrief).default([]),
});

export type ConciergeDailyBrief = z.infer<typeof ConciergeDailyBrief>;
export type ConciergeDailyBriefQuery = z.infer<typeof ConciergeDailyBriefQuery>;
export type ConciergeDailyBriefResponse = z.infer<typeof ConciergeDailyBriefResponse>;

export const TimeToLeaveDeparture = z.object({
  id: z.string(),
  label: z.string(),
  recommended_departure: z.string(),
  window_minutes: z.number().int().nonnegative().optional(),
  buffer_minutes: z.number().int().nonnegative().optional(),
  pickup_point: z.string().optional(),
  status: z.string().default("on_track"),
  transport: z
    .object({
      provider: z.string().optional(),
      vehicle: z.string().optional(),
      driver: z.string().optional(),
      contact_phone: z.string().optional(),
    })
    .optional(),
  notes: z.array(z.string()).default([]),
});

export const TimeToLeaveQuery = z
  .object({
    itineraryId: z.string().uuid().optional(),
    limit: z.number().int().positive().max(7).optional(),
    upcoming: z.literal("1").optional(),
    now: z.string().optional(),
  })
  .partial()
  .default({});

export const TimeToLeaveResponse = z.object({
  ok: z.boolean(),
  request_id: z.string().optional(),
  source: z.string().optional(),
  itinerary_id: z.string().optional(),
  timezone: z.string().optional(),
  departures: z.array(TimeToLeaveDeparture).default([]),
  next_departure: z.string().nullable().optional(),
});

export type TimeToLeaveDeparture = z.infer<typeof TimeToLeaveDeparture>;
export type TimeToLeaveQuery = z.infer<typeof TimeToLeaveQuery>;
export type TimeToLeaveResponse = z.infer<typeof TimeToLeaveResponse>;

export const SafetyAdvisoryRecord = z.object({
  id: z.string(),
  level: z.string(),
  title: z.string(),
  summary: z.string(),
  details: z.string(),
  effective_from: z.string(),
  effective_to: z.string(),
  actions: z.array(z.string()).default([]),
  channels: z.array(z.string()).default([]),
  external_reference: z.string().url().optional(),
});

export const SafetyAdvisoryQuery = z
  .object({
    itineraryId: z.string().uuid().optional(),
    level: z.string().optional(),
    channel: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  })
  .partial()
  .default({});

export const SafetyAdvisoryResponse = z.object({
  ok: z.boolean(),
  request_id: z.string().optional(),
  source: z.string().optional(),
  itinerary_id: z.string().optional(),
  region: z.string().optional(),
  provider: z.string().optional(),
  advisories: z.array(SafetyAdvisoryRecord).default([]),
});

export type SafetyAdvisoryRecord = z.infer<typeof SafetyAdvisoryRecord>;
export type SafetyAdvisoryQuery = z.infer<typeof SafetyAdvisoryQuery>;
export type SafetyAdvisoryResponse = z.infer<typeof SafetyAdvisoryResponse>;
