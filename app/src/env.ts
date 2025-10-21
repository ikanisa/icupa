import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL."),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required."),
});

const optionalEnvSchema = z.object({
  PLAYWRIGHT_BASE_URL: z
    .string()
    .url("PLAYWRIGHT_BASE_URL must be a valid URL.")
    .optional(),
});

export const serverEnv = serverEnvSchema.parse({
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

export const optionalEnv = optionalEnvSchema.parse({
  PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL,
});

export type ServerEnv = typeof serverEnv;
export type OptionalEnv = typeof optionalEnv;
