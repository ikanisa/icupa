import { z } from "zod";

export const FlagVariantMetric = z.object({
  name: z.string(),
  exposure: z.number(),
  conversions: z.number(),
  uplift: z.number().optional(),
});

export const FlagConfigEntry = z.object({
  key: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().default(false),
  variants: z.array(FlagVariantMetric).default([]),
});

export const FlagsConfigResponse = z.object({
  ok: z.boolean(),
  request_id: z.string().optional(),
  flags: z.array(FlagConfigEntry).default([]),
  analytics_forwarded: z.number().optional(),
});

export type FlagVariantMetric = z.infer<typeof FlagVariantMetric>;
export type FlagConfigEntry = z.infer<typeof FlagConfigEntry>;
export type FlagsConfigResponse = z.infer<typeof FlagsConfigResponse>;
