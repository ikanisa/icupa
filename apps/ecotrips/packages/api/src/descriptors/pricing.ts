import type { DescriptorMap } from "../types";
import { PricingApplyInput, PricingApplyResult } from "@ecotrips/types";

export const pricingDescriptors = {
  "pricing.apply": {
    path: "/functions/v1/pricing-apply",
    method: "POST",
    auth: "user",
    input: PricingApplyInput,
    output: PricingApplyResult,
  },
} satisfies DescriptorMap;
