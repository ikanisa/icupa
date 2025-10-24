import { PriceBreakdownRequest, PriceBreakdownResponse } from "@ecotrips/types";

import type { DescriptorMap } from "../types";

export const helpersDescriptors = {
  "helpers.price": {
    path: "/functions/v1/helpers-price",
    method: "POST",
    auth: "anon",
    input: PriceBreakdownRequest,
    output: PriceBreakdownResponse,
    cacheTtlMs: 300_000,
  },
} satisfies DescriptorMap;
