import { functionDescriptors } from "@ecotrips/api";
import { InventorySearchInput } from "@ecotrips/types";
import { z } from "zod";

import { getServerFunctionClient } from "../api/client";

export type InventorySearchOutput = z.infer<
  NonNullable<(typeof functionDescriptors)["inventory.search"]["output"]>
>;
export type InventorySearchItem = InventorySearchOutput["items"][number];

export type RawSearchParams = Record<string, string | string[] | undefined>;

const FALLBACK_RESULTS: InventorySearchOutput = {
  ok: false,
  items: [],
  cacheHit: true,
};

export function parseSearchParams(searchParams: RawSearchParams): InventorySearchInput {
  const destination = typeof searchParams.destination === "string" ? searchParams.destination : "Kigali";
  const startDate = typeof searchParams.startDate === "string" ? searchParams.startDate : new Date().toISOString().slice(0, 10);
  const endDate =
    typeof searchParams.endDate === "string"
      ? searchParams.endDate
      : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const adults = Number(Array.isArray(searchParams.adults) ? searchParams.adults[0] : searchParams.adults ?? 2);
  const children = Number(Array.isArray(searchParams.children) ? searchParams.children[0] : searchParams.children ?? 0);

  const parsed = InventorySearchInput.safeParse({
    destination,
    startDate,
    endDate,
    party: { adults: Number.isFinite(adults) ? adults : 2, children: Number.isFinite(children) ? children : 0 },
  });

  return parsed.success
    ? parsed.data
    : {
        destination,
        startDate,
        endDate,
        party: { adults: 2, children: 0 },
        budgetHint: "balanced",
        locale: "en",
      };
}

export async function loadInventorySearch(searchParams: RawSearchParams): Promise<InventorySearchOutput> {
  const input = parseSearchParams(searchParams);
  const client = getServerFunctionClient();

  if (!client) {
    return FALLBACK_RESULTS;
  }

  try {
    return await client.call("inventory.search", input);
  } catch (error) {
    console.error("inventory.search failed", error);
    return FALLBACK_RESULTS;
  }
}
