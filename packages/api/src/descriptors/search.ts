import { SearchPlacesInput, SearchPlacesResponse } from "@ecotrips/types";

import type { DescriptorMap } from "../types";

export const searchDescriptors = {
  "search.places": {
    path: "/functions/v1/search-places",
    method: "POST",
    auth: "anon",
    input: SearchPlacesInput,
    output: SearchPlacesResponse,
    cacheTtlMs: 15000,
  },
} satisfies DescriptorMap;
