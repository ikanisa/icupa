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
} satisfies DescriptorMap;
