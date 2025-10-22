import { assertSupabaseServiceEnv } from "@ecotrips/config/env";
import { z } from "zod";

const optionalEnvSchema = z.object({
  PLAYWRIGHT_BASE_URL: z
    .string()
    .url("PLAYWRIGHT_BASE_URL must be a valid URL.")
    .optional(),
});

export const serverEnv = assertSupabaseServiceEnv(process.env);

export const optionalEnv = optionalEnvSchema.parse({
  PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL,
});

export type ServerEnv = typeof serverEnv;
export type OptionalEnv = typeof optionalEnv;
