import { z } from "zod";

import type { DescriptorMap } from "../types";
import { InventoryQuoteInput, InventorySearchInput } from "@ecotrips/types";

export const inventoryDescriptors = {
  "inventory.search": {
    path: "/functions/v1/inventory-search",
    method: "POST",
    auth: "anon",
    input: InventorySearchInput,
    output: z.object({
      ok: z.boolean(),
      items: z.array(z.record(z.any())).default([]),
      cacheHit: z.boolean().optional(),
    }),
    cacheTtlMs: 600_000,
  },
  "inventory.quote": {
    path: "/functions/v1/inventory-quote",
    method: "POST",
    auth: "anon",
    input: InventoryQuoteInput,
    output: z.object({ ok: z.boolean(), quote: z.record(z.any()).optional() }),
    cacheTtlMs: 120_000,
  },
} satisfies DescriptorMap;
