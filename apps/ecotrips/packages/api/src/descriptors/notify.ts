import { z } from "zod";

import type { DescriptorMap } from "../types";
import { PushDelivery, PushSendInput, PushSubscriptionInput } from "@ecotrips/types";

export const notifyDescriptors = {
  "notify.pushSubscribe": {
    path: "/functions/v1/push-subscribe",
    method: "POST",
    auth: "anon",
    input: PushSubscriptionInput,
    output: z.object({
      ok: z.boolean(),
      subscription_id: z.string().optional(),
      request_id: z.string().optional(),
      mode: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
  },
  "notify.pushSend": {
    path: "/functions/v1/push-send",
    method: "POST",
    auth: "user",
    input: PushSendInput,
    output: z.object({
      ok: z.boolean(),
      request_id: z.string().optional(),
      deliveries: z.array(PushDelivery).default([]),
      dry_run: z.boolean().optional(),
      meta: z.record(z.any()).optional(),
    }),
  },
} satisfies DescriptorMap;
