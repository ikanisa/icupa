import { z } from "zod";

import type { DescriptorMap } from "../types";
import { InvoiceGenerateInput } from "@ecotrips/types";

export const financeDescriptors = {
  "fin.invoice.generate": {
    path: "/functions/v1/fin-invoice-generate",
    method: "POST",
    auth: "user",
    input: InvoiceGenerateInput,
    output: z.object({
      ok: z.boolean(),
      invoice_id: z.string().optional(),
      number: z.string().optional(),
      signed_url: z.string().optional(),
      reused: z.boolean().optional(),
    }),
  },
} satisfies DescriptorMap;
