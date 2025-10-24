import { z } from "zod";
import type { DescriptorMap } from "../types";

const referralLinkInput = z.object({
  inviter_user_id: z.string().uuid(),
  invitee_email: z.string().email(),
  invitee_user_id: z.string().uuid().optional(),
  channel: z.union([z.string(), z.array(z.string())]).optional(),
  consent: z.literal(true),
  idempotency_key: z.string().min(1).optional(),
  referral_code: z.string().min(4).optional(),
});

const referralLinkOutput = z.object({
  ok: z.boolean(),
  request_id: z.string().optional(),
  invitation_id: z.string().uuid().optional(),
  referral_code: z.string().optional(),
  status: z.string().optional(),
  link: z.string().url().optional(),
  reused: z.boolean().optional(),
  mode: z.string().optional(),
});

const rewardGrantInput = z.object({
  user_id: z.string().uuid(),
  amount_cents: z.number().int().min(1),
  currency: z.string().min(3).max(8).default("USD"),
  source: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  referral_invitation_id: z.string().uuid().optional(),
  idempotency_key: z.string().min(1),
  referred_increment: z.number().int().min(0).optional(),
  metadata: z.record(z.any()).optional(),
  consent: z.literal(true),
});

const rewardGrantOutput = z.object({
  ok: z.boolean(),
  request_id: z.string().optional(),
  reused: z.boolean().optional(),
  mode: z.string().optional(),
  ledger_entry: z
    .object({
      id: z.string(),
      user_id: z.string().uuid().optional(),
      amount_cents: z.number().int().optional(),
      currency: z.string().optional(),
      status: z.string().optional(),
      source: z.string().optional(),
      idempotency_key: z.string().optional(),
    })
    .optional(),
});

const priceLockOfferInput = z.object({
  itinerary_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  price_cents: z.number().int().min(1),
  currency: z.string().min(3).max(8).default("USD"),
  hold_reference: z.string().optional(),
  hold_expires_at: z.string().datetime().optional(),
  idempotency_key: z.string().min(1),
  consent: z.literal(true),
  telemetry: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

const priceLockOfferOutput = z.object({
  ok: z.boolean(),
  request_id: z.string().optional(),
  reused: z.boolean().optional(),
  mode: z.string().optional(),
  offer: z
    .object({
      id: z.string(),
      itinerary_id: z.string().uuid().nullable().optional(),
      user_id: z.string().uuid().nullable().optional(),
      price_cents: z.number().int().optional(),
      currency: z.string().optional(),
      hold_reference: z.string().nullable().optional(),
      hold_expires_at: z.string().datetime().nullable().optional(),
      status: z.string().optional(),
      idempotency_key: z.string().optional(),
    })
    .optional(),
});

const holdExtendInput = z.object({
  offer_id: z.string().uuid(),
  extension_minutes: z.number().int().min(1).optional(),
  idempotency_key: z.string().min(1),
  consent: z.literal(true).or(z.undefined()).optional(),
  reason: z.string().optional(),
});

const holdExtendOutput = z.object({
  ok: z.boolean(),
  request_id: z.string().optional(),
  reused: z.boolean().optional(),
  mode: z.string().optional(),
  offer_id: z.string().uuid().optional(),
  hold_expires_at: z.string().datetime().optional(),
});

const providersAirStatusInput = z
  .object({
    provider: z.string().optional(),
    flight: z.string().optional(),
    route: z.string().optional(),
    date: z.string().optional(),
  })
  .partial()
  .default({});

const providersAirStatusOutput = z.object({
  ok: z.boolean(),
  request_id: z.string().optional(),
  mode: z.string().optional(),
  provider: z.string().optional(),
  flight: z.string().optional(),
  date: z.string().optional(),
  route: z.string().optional(),
  status: z.unknown().optional(),
});

const rebookSuggestInput = z.object({
  disruption_id: z.string().uuid().optional(),
  itinerary_id: z.string().uuid().optional(),
  suggestion: z.record(z.any()).optional(),
  idempotency_key: z.string().min(1),
  consent: z.literal(true),
});

const rebookSuggestOutput = z.object({
  ok: z.boolean(),
  request_id: z.string().optional(),
  reused: z.boolean().optional(),
  mode: z.string().optional(),
  suggestion: z
    .object({
      id: z.string(),
      disruption_id: z.string().uuid().nullable().optional(),
      itinerary_id: z.string().uuid().nullable().optional(),
      status: z.string().optional(),
      suggestion: z.unknown().optional(),
      idempotency_key: z.string().optional(),
    })
    .optional(),
});

export const growthDescriptors = {
  "growth.referral_link": {
    path: "/functions/v1/referral-link",
    method: "POST",
    auth: "user",
    input: referralLinkInput,
    output: referralLinkOutput,
  },
  "growth.reward_grant": {
    path: "/functions/v1/reward-grant",
    method: "POST",
    auth: "service_role",
    input: rewardGrantInput,
    output: rewardGrantOutput,
  },
  "growth.price_lock_offer": {
    path: "/functions/v1/price-lock-offer",
    method: "POST",
    auth: "user",
    input: priceLockOfferInput,
    output: priceLockOfferOutput,
  },
  "growth.hold_extend": {
    path: "/functions/v1/hold-extend-offer",
    method: "POST",
    auth: "service_role",
    input: holdExtendInput,
    output: holdExtendOutput,
  },
  "growth.air_status": {
    path: "/functions/v1/providers-air-status",
    method: "GET",
    auth: "user",
    input: providersAirStatusInput,
    output: providersAirStatusOutput,
  },
  "growth.rebook_suggest": {
    path: "/functions/v1/rebook-suggest",
    method: "POST",
    auth: "service_role",
    input: rebookSuggestInput,
    output: rebookSuggestOutput,
  },
} as const satisfies DescriptorMap;

export type GrowthDescriptorKey = keyof typeof growthDescriptors;
