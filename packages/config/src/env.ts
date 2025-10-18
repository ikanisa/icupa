import { z } from 'zod';

const optionalUrl = z
  .string()
  .url({ message: 'Must be a valid URL' })
  .optional();

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url({ message: 'NEXT_PUBLIC_SUPABASE_URL must be a valid URL' }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  NEXT_PUBLIC_AGENTS_URL: optionalUrl,
});

export const serverEnvSchema = clientEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required when issued to services')
    .optional(),
  NEXT_PUBLIC_APP_URL: optionalUrl,
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

const formatIssues = (issues: z.ZodIssue[]) =>
  issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('\n');

export const parseClientEnv = (env: Record<string, string | undefined>): ClientEnv => {
  const result = clientEnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid client environment configuration:\n${formatIssues(result.error.issues)}`);
  }
  return result.data;
};

export const parseServerEnv = (env: Record<string, string | undefined>): ServerEnv => {
  const result = serverEnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid server environment configuration:\n${formatIssues(result.error.issues)}`);
  }
  return result.data;
};

export const loadClientEnv = (): ClientEnv =>
  parseClientEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_AGENTS_URL: process.env.NEXT_PUBLIC_AGENTS_URL,
  });

export const loadServerEnv = (): ServerEnv =>
  parseServerEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_AGENTS_URL: process.env.NEXT_PUBLIC_AGENTS_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
