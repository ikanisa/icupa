import { AirPriceWatchInput, AirPriceWatchResult } from "@ecotrips/types";

import type { DescriptorMap } from "../types";

export const airDescriptors = {
  "air.price.watch": {
    path: "/functions/v1/air-price-watch",
    method: "POST",
    auth: "user",
    input: AirPriceWatchInput,
    output: AirPriceWatchResult,
  },
} satisfies DescriptorMap;
