import { z } from "zod";

import { LocaleEnum } from "./shared";

export const WalletOfflinePackInput = z.object({
  itineraryId: z.string().uuid(),
  locale: LocaleEnum.default("en"),
});

export type WalletOfflinePackInput = z.infer<typeof WalletOfflinePackInput>;
