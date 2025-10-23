import {
  assertSupabaseServiceEnv,
  supabaseServiceEnvSchema,
} from "@ecotrips/config/env";
import { z } from "zod";

const optionalEnvSchema = z.object({
  PLAYWRIGHT_BASE_URL: z
    .string()
    .url("PLAYWRIGHT_BASE_URL must be a valid URL.")
    .optional(),
});

const shouldSkipValidation = process.env.SKIP_ENV_VALIDATION === "true";

const fallbackServiceEnv = shouldSkipValidation
  ? supabaseServiceEnvSchema.parse({
      SUPABASE_URL:
        process.env.SUPABASE_URL ?? "http://127.0.0.1:54321",
      SUPABASE_SERVICE_ROLE_KEY:
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? "service-role-key-placeholder",
    })
  : assertSupabaseServiceEnv(process.env);

export const serverEnv = fallbackServiceEnv;

export const optionalEnv = optionalEnvSchema.parse({
  PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL,
});

export type ServerEnv = typeof serverEnv;
export type OptionalEnv = typeof optionalEnv;
