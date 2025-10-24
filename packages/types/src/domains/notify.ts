import { z } from "zod";

export const PushSubscriptionKeys = z.object({
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

export const PushSubscriptionInput = z.object({
  endpoint: z.string().min(1),
  keys: PushSubscriptionKeys,
  tags: z.array(z.string().min(1)).optional(),
  profile_id: z.string().uuid().optional(),
});

export type PushSubscriptionInput = z.infer<typeof PushSubscriptionInput>;

export const PushSendAudience = z.union([
  z.string().min(1),
  z.array(z.string().min(1)).min(1),
  z.object({
    tags: z.array(z.string().min(1)).min(1),
  }),
]);

export type PushSendAudience = z.infer<typeof PushSendAudience>;

export const PushSendInput = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  audience: PushSendAudience.optional(),
  data: z.record(z.any()).optional(),
  dry_run: z.boolean().optional(),
});

export type PushSendInput = z.infer<typeof PushSendInput>;

export const PushDelivery = z.object({
  subscription_id: z.string(),
  endpoint: z.string(),
  status: z.enum(["delivered", "failed", "skipped"]),
  latency_ms: z.number(),
  error: z.string().optional(),
});

export type PushDelivery = z.infer<typeof PushDelivery>;
