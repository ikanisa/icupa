import type { ZodIssue, ZodTypeAny, infer as Infer } from "zod";

export declare const SUPABASE_PUBLIC_ENV_KEYS: readonly [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
];
export declare const SUPABASE_SERVICE_ENV_KEYS: readonly [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY"
];
export declare const SUPABASE_ANON_ENV_KEYS: readonly [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY"
];

export declare const supabasePublicEnvSchema: ZodTypeAny;
export declare const supabaseServiceEnvSchema: ZodTypeAny;
export declare const supabaseAnonEnvSchema: ZodTypeAny;

export interface EnvCheckSuccess<TValue> {
  ok: true;
  data: TValue;
}

export interface EnvCheckFailure {
  ok: false;
  missing: string[];
  issues: ZodIssue[];
  error: unknown;
}

export type EnvCheckResult<TValue> = EnvCheckSuccess<TValue> | EnvCheckFailure;

export declare class EnvValidationError extends Error {
  constructor(
    message: string,
    options?: { missing?: string[]; issues?: ZodIssue[]; cause?: unknown },
  );
  readonly missing: string[];
  readonly issues: ZodIssue[];
}

export declare function checkEnv<TSchema extends ZodTypeAny>(
  schema: TSchema,
  env?: Record<string, unknown>,
): EnvCheckResult<Infer<TSchema>>;

export declare function assertEnv<TSchema extends ZodTypeAny>(
  schema: TSchema,
  env?: Record<string, unknown>,
  label?: string,
): Infer<TSchema>;

export declare function checkSupabasePublicEnv(
  env?: Record<string, unknown>,
): EnvCheckResult<Infer<typeof supabasePublicEnvSchema>>;

export declare function assertSupabasePublicEnv(
  env?: Record<string, unknown>,
): Infer<typeof supabasePublicEnvSchema>;

export declare function checkSupabaseServiceEnv(
  env?: Record<string, unknown>,
): EnvCheckResult<Infer<typeof supabaseServiceEnvSchema>>;

export declare function assertSupabaseServiceEnv(
  env?: Record<string, unknown>,
): Infer<typeof supabaseServiceEnvSchema>;

export declare function checkSupabaseAnonEnv(
  env?: Record<string, unknown>,
): EnvCheckResult<Infer<typeof supabaseAnonEnvSchema>>;

export declare function assertSupabaseAnonEnv(
  env?: Record<string, unknown>,
): Infer<typeof supabaseAnonEnvSchema>;
