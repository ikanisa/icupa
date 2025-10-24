import { functionDescriptors } from "@ecotrips/api";
import { z } from "zod";

import { getServerFunctionClient } from "../api/client";

export type InventoryQuoteOutput = z.infer<
  NonNullable<(typeof functionDescriptors)["inventory.quote"]["output"]>
>;

const FALLBACK_QUOTE: InventoryQuoteOutput = {
  ok: false,
  quote: undefined,
};

export async function loadInventoryQuote(quoteId: string, locale: "en" | "rw" = "en"): Promise<InventoryQuoteOutput> {
  const client = getServerFunctionClient();

  if (!client) {
    return FALLBACK_QUOTE;
  }

  try {
    return await client.call("inventory.quote", { quoteId, locale });
  } catch (error) {
    console.error("inventory.quote failed", error);
    return FALLBACK_QUOTE;
  }
}
