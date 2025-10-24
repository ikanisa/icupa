import {
  ConciergeDailyBriefQuery,
  ConciergeDailyBriefResponse,
  SafetyAdvisoryQuery,
  SafetyAdvisoryResponse,
  TimeToLeaveQuery,
  TimeToLeaveResponse,
} from "@ecotrips/types";

import type { DescriptorMap } from "../types";

export const conciergeDescriptors = {
  "concierge.dailyBrief": {
    path: "/functions/v1/concierge-daily-brief",
    method: "GET",
    auth: "user",
    input: ConciergeDailyBriefQuery,
    output: ConciergeDailyBriefResponse,
    cacheTtlMs: 120_000,
  },
  "concierge.timeToLeave": {
    path: "/functions/v1/time-to-leave",
    method: "GET",
    auth: "user",
    input: TimeToLeaveQuery,
    output: TimeToLeaveResponse,
    cacheTtlMs: 60_000,
  },
  "concierge.safetyAdvisory": {
    path: "/functions/v1/safety-advisory",
    method: "GET",
    auth: "user",
    input: SafetyAdvisoryQuery,
    output: SafetyAdvisoryResponse,
    cacheTtlMs: 180_000,
  },
} satisfies DescriptorMap;
