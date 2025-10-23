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
