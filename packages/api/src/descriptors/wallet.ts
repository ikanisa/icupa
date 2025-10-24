import { z } from "zod";

import type { DescriptorMap } from "../types";
import { WalletOfflinePackInput } from "@ecotrips/types";

export const walletDescriptors = {
  "wallet.offlinePack": {
    path: "/functions/v1/privacy-export",
    method: "POST",
    auth: "user",
    input: WalletOfflinePackInput,
    output: z.object({ ok: z.boolean(), download_url: z.string().url().optional() }),
  },
  "wallet.tripRecap": {
    path: "/functions/v1/trip-recap",
    method: "POST",
    auth: "anon",
    input: z.object({
      itinerary_id: z.string().min(1),
      email: z.string().email().optional(),
      locale: z.string().optional(),
    }),
    output: z.object({
      ok: z.boolean(),
      recap: z.object({
        recap_id: z.string(),
        subject: z.string(),
        summary: z.string(),
        highlights: z.array(z.string()).default([]),
        cta_url: z.string(),
        preview_html: z.string(),
        generated_at: z.string(),
      }),
      request_id: z.string().optional(),
    }),
  },
} satisfies DescriptorMap;
