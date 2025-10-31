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
const isNodeProduction = process.env.NODE_ENV === "production";
const isCiEnvironment =
  process.env.CI === "true" || process.env.CI === "1" || process.env.CONTINUOUS_INTEGRATION === "true";
const isLocalEnvironment = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;

if (
  shouldSkipValidation &&
  isNodeProduction &&
  !isCiEnvironment
) {
  throw new Error(
    "SKIP_ENV_VALIDATION cannot be used when deploying the production runtime.",
  );
}

if (shouldSkipValidation && !(isCiEnvironment || isLocalEnvironment)) {
  throw new Error(
    "SKIP_ENV_VALIDATION is only supported for local development and CI workflows.",
  );
}

const isFallbackAllowed =
  shouldSkipValidation &&
  (isCiEnvironment || isLocalEnvironment) &&
  !isNodeProduction;

const fallbackServiceEnv = isFallbackAllowed
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
