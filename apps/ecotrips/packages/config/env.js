import { z } from "zod";

export const SUPABASE_PUBLIC_ENV_KEYS = Object.freeze([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]);

export const SUPABASE_SERVICE_ENV_KEYS = Object.freeze([
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
]);

export const SUPABASE_ANON_ENV_KEYS = Object.freeze([
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
]);

export const supabasePublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL."),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required."),
});

export const supabaseServiceEnvSchema = z.object({
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL."),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required."),
});

export const supabaseAnonEnvSchema = z.object({
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL."),
  SUPABASE_ANON_KEY: z
    .string()
    .min(1, "SUPABASE_ANON_KEY is required."),
});

export class EnvValidationError extends Error {
  constructor(message, { missing = [], issues = [], cause } = {}) {
    super(message);
    this.name = "EnvValidationError";
    this.missing = [...missing];
    this.issues = [...issues];
    if (cause) {
      this.cause = cause;
    }
  }
}

function normalizeIssuePath(issue) {
  return issue.path.length > 0 ? issue.path.join(".") : issue.path[0] ?? "";
}

export function checkEnv(schema, env = process.env) {
  const result = schema.safeParse(env);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  const missing = new Set();
  const issues = [];

  for (const issue of result.error.issues) {
    const key = normalizeIssuePath(issue);
    if (issue.code === "invalid_type" && issue.received === "undefined") {
      missing.add(key);
    }
    issues.push(issue);
  }

  return {
    ok: false,
    missing: Array.from(missing),
    issues,
    error: result.error,
  };
}

export function assertEnv(schema, env = process.env, label = "environment") {
  const result = checkEnv(schema, env);
  if (!result.ok) {
    throw new EnvValidationError(`Missing or invalid ${label} variables.`, {
      missing: result.missing,
      issues: result.issues,
      cause: result.error,
    });
  }

  return result.data;
}

export function checkSupabasePublicEnv(env = process.env) {
  return checkEnv(supabasePublicEnvSchema, env);
}

export function assertSupabasePublicEnv(env = process.env) {
  return assertEnv(supabasePublicEnvSchema, env, "Supabase public");
}

export function checkSupabaseServiceEnv(env = process.env) {
  return checkEnv(supabaseServiceEnvSchema, env);
}

export function assertSupabaseServiceEnv(env = process.env) {
  return assertEnv(supabaseServiceEnvSchema, env, "Supabase service");
}

export function checkSupabaseAnonEnv(env = process.env) {
  return checkEnv(supabaseAnonEnvSchema, env);
}

export function assertSupabaseAnonEnv(env = process.env) {
  return assertEnv(supabaseAnonEnvSchema, env, "Supabase anon");
}
