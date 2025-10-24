import { z } from "zod";

import { CurrencyCode } from "./shared";

export const EscrowCreate = z.object({
  name: z.string().min(3),
  targetAmountCents: z.number().int().min(1000),
  currency: CurrencyCode,
  deadline: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "invalid_date"),
  itineraryId: z.string().uuid(),
});

export type EscrowCreate = z.infer<typeof EscrowCreate>;

export const GroupJoinInput = z.object({
  escrowId: z.string().uuid(),
  inviteCode: z.string().min(4),
});

export type GroupJoinInput = z.infer<typeof GroupJoinInput>;

export const ContributionCreate = z.object({
  escrowId: z.string().uuid(),
  amountCents: z.number().int().min(1000),
  currency: CurrencyCode,
  contributorName: z.string().min(2),
  idempotencyKey: z.string().min(10),
});

export type ContributionCreate = z.infer<typeof ContributionCreate>;

export const GroupsPayoutReportQuery = z
  .object({
    from: z.string().min(4).optional(),
    to: z.string().min(4).optional(),
  })
  .partial();

export type GroupsPayoutReportQuery = z.infer<typeof GroupsPayoutReportQuery>;

export const GroupsOpsPayoutNowInput = z.object({
  escrow_id: z.string().uuid(),
});

export type GroupsOpsPayoutNowInput = z.infer<typeof GroupsOpsPayoutNowInput>;

const SuggestionBadge = z.object({
  label: z.string().min(1),
  tone: z.enum(["neutral", "info", "success", "warning"]).default("info"),
});

export type GroupSuggestionBadge = z.infer<typeof SuggestionBadge>;

const SuggestionAction = z.object({
  label: z.string().min(1),
  intent: z
    .enum(["view_itinerary", "start_escrow", "connect_ops", "share", "rerun"])
    .default("connect_ops"),
  href: z.string().url().optional(),
});

export type GroupSuggestionAction = z.infer<typeof SuggestionAction>;

export const GroupSuggestion = z.object({
  id: z.string().min(1),
  title: z.string().min(3),
  summary: z.string().min(5),
  badges: z.array(SuggestionBadge).default([]),
  actions: z.array(SuggestionAction).default([]),
});

export type GroupSuggestion = z.infer<typeof GroupSuggestion>;

export const GroupSuggestionInput = z
  .object({
    user_id: z.string().uuid().optional(),
    session_id: z.string().uuid().optional(),
    topic: z.string().min(2).max(140).optional(),
    locale: z.enum(["en", "rw"]).optional(),
    budget_hint: z.enum(["lean", "balanced", "premium"]).optional(),
    group_size: z.number().int().positive().max(200).optional(),
    travel_window: z
      .object({
        start: z.string().min(4).optional(),
        end: z.string().min(4).optional(),
      })
      .partial()
      .optional(),
  })
  .default({});

export type GroupSuggestionInput = z.infer<typeof GroupSuggestionInput>;

export const GroupSuggestionResponse = z.object({
  ok: z.boolean(),
  session_id: z.string().uuid().optional(),
  suggestions: z.array(GroupSuggestion).default([]),
  follow_up: z.string().optional(),
  request_id: z.string().optional(),
});

export type GroupSuggestionResponse = z.infer<typeof GroupSuggestionResponse>;
