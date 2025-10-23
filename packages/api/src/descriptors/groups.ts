import { z } from "zod";

import type { DescriptorMap } from "../types";
import {
  ContributionCreate,
  EscrowCreate,
  GroupJoinInput,
  GroupsOpsPayoutNowInput,
  GroupsPayoutReportQuery,
} from "@ecotrips/types";

export const groupsDescriptors = {
  "groups.create": {
    path: "/functions/v1/groups-create-escrow",
    method: "POST",
    auth: "user",
    input: EscrowCreate,
    output: z.object({ ok: z.boolean(), escrow_id: z.string().uuid().optional() }),
  },
  "groups.join": {
    path: "/functions/v1/groups-join",
    method: "POST",
    auth: "user",
    input: GroupJoinInput,
    output: z.object({ ok: z.boolean(), member_id: z.string().uuid().optional() }),
  },
  "groups.contribute": {
    path: "/functions/v1/groups-contribute",
    method: "POST",
    auth: "user",
    input: ContributionCreate,
    output: z.object({ ok: z.boolean(), contribution_id: z.string().uuid().optional() }),
  },
  "groups.payouts.report": {
    path: "/functions/v1/groups-payouts-report",
    method: "GET",
    auth: "user",
    input: GroupsPayoutReportQuery.default({}),
    output: z.object({
      ok: z.boolean(),
      request_id: z.string().optional(),
      range: z
        .object({ from: z.string().nullable(), to: z.string().nullable() })
        .partial()
        .optional(),
      counts: z
        .array(
          z.object({
            status: z.string(),
            currency: z.string(),
            count: z.number(),
          }),
        )
        .default([]),
      recent: z
        .array(
          z.object({
            id: z.string().optional(),
            escrow_id: z.string().optional(),
            total_cents: z.number().optional(),
            currency: z.string().optional(),
            status: z.string().optional(),
            attempts: z.number().optional(),
            last_error: z.string().nullable().optional(),
            created_at: z.string().optional(),
          }),
        )
        .default([]),
    }),
  },
  "groups.ops.payoutNow": {
    path: "/functions/v1/groups-ops-payout-now",
    method: "POST",
    auth: "user",
    input: GroupsOpsPayoutNowInput,
    output: z.object({
      ok: z.boolean(),
      request_id: z.string().optional(),
      escrow_id: z.string().optional(),
      payout_id: z.string().optional(),
      payout_status: z.string().optional(),
      total_cents: z.number().optional(),
    }),
  },
} satisfies DescriptorMap;
