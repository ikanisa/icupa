import { z } from "zod";

import type { DescriptorMap } from "../types";
import { CheckoutInput, PaymentEscalationInput, PaymentEscalationResponse } from "@ecotrips/types";

export const checkoutDescriptors = {
  "checkout.intent": {
    path: "/functions/v1/bff-checkout",
    method: "POST",
    auth: "user",
    input: CheckoutInput,
    output: z.object({
      ok: z.boolean(),
      payment_intent_id: z.string().optional(),
      client_secret: z.string().optional(),
      ledger_entry_id: z.string().optional(),
    }),
  },
  "checkout.escalate": {
    path: "/functions/v1/payment-escalate",
    method: "POST",
    auth: "user",
    input: PaymentEscalationInput,
    output: PaymentEscalationResponse,
  },
} satisfies DescriptorMap;
