import { z } from "zod";

export const AffiliateOutboundInput = z.object({
  partner: z.string().min(1, "partner required"),
  event: z.string().min(1, "event required"),
  payload: z.record(z.any()).default({}),
  dryRun: z.boolean().default(true),
  note: z.string().trim().min(1).optional(),
});

export type AffiliateOutboundInput = z.infer<typeof AffiliateOutboundInput>;

export const AffiliateOutboundResult = z.object({
  ok: z.boolean(),
  request_id: z.string().optional(),
  event_id: z.string().optional(),
  signature: z.string().nullable().optional(),
  timestamp: z.string().optional(),
  dry_run: z.boolean().optional(),
  error: z.string().optional(),
});

export type AffiliateOutboundResult = z.infer<typeof AffiliateOutboundResult>;

export const AffiliateEventFilter = z.object({
  partner: z.string().optional(),
  direction: z.enum(["inbound", "outbound"]).optional(),
  status: z.enum(["valid", "invalid", "missing", "skipped", "unknown"]).optional(),
});

export type AffiliateEventFilter = z.infer<typeof AffiliateEventFilter>;
