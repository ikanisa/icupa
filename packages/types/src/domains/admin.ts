import { z } from "zod";

export const SynthSeedRecord = z.object({
  key: z.string(),
  count: z.number(),
});

export const SynthGenerateInput = z.object({
  scope: z.array(z.string()).optional(),
});

export const SynthGenerateResponse = z.object({
  ok: z.boolean(),
  request_id: z.string().optional(),
  seeded: z.array(SynthSeedRecord).default([]),
  message: z.string().optional(),
});

export type SynthSeedRecord = z.infer<typeof SynthSeedRecord>;
export type SynthGenerateInput = z.infer<typeof SynthGenerateInput>;
export type SynthGenerateResponse = z.infer<typeof SynthGenerateResponse>;
