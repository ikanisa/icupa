import type { DescriptorMap } from "../types";
import { LoyaltyGrantInput, LoyaltyGrantResult } from "@ecotrips/types";

export const loyaltyDescriptors = {
  "loyalty.grant": {
    path: "/functions/v1/loyalty-grant",
    method: "POST",
    auth: "user",
    input: LoyaltyGrantInput,
    output: LoyaltyGrantResult,
  },
} satisfies DescriptorMap;
