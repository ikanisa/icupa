import type { DescriptorMap } from "../types";
import { MapsTilesListInput, MapsTilesListResponse } from "@ecotrips/types";

export const mapsDescriptors = {
  "maps.tiles.list": {
    path: "/functions/v1/maps-tiles-list",
    method: "GET",
    auth: "anon",
    input: MapsTilesListInput.partial(),
    output: MapsTilesListResponse,
    cacheTtlMs: 300_000,
  },
} satisfies DescriptorMap;
