import type {
  ConciergeDailyBriefQuery,
  ConciergeDailyBriefResponse,
  SafetyAdvisoryQuery,
  SafetyAdvisoryResponse,
  TimeToLeaveQuery,
  TimeToLeaveResponse,
} from "@ecotrips/types";

import type { FunctionCaller, RequestOptions } from "../types";
import type { FunctionMap } from "../descriptors";

export type ConciergeClient = {
  dailyBrief(
    input?: ConciergeDailyBriefQuery,
    options?: RequestOptions,
  ): Promise<ConciergeDailyBriefResponse>;
  timeToLeave(
    input?: TimeToLeaveQuery,
    options?: RequestOptions,
  ): Promise<TimeToLeaveResponse>;
  safetyAdvisory(
    input?: SafetyAdvisoryQuery,
    options?: RequestOptions,
  ): Promise<SafetyAdvisoryResponse>;
};

export function createConciergeClient(client: FunctionCaller<FunctionMap>): ConciergeClient {
  return {
    dailyBrief(input, options) {
      return client.call("concierge.dailyBrief", input ?? {}, options);
    },
    timeToLeave(input, options) {
      return client.call("concierge.timeToLeave", input ?? {}, options);
    },
    safetyAdvisory(input, options) {
      return client.call("concierge.safetyAdvisory", input ?? {}, options);
    },
  };
}
