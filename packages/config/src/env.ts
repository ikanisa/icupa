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

type EnvRecord = Record<string, string | undefined>;

type EnvKeyMapping = {
  key: keyof ClientEnv | keyof ServerEnv;
  fallbacks?: string[];
};

const clientKeyMappings: EnvKeyMapping[] = [
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    fallbacks: ['VITE_SUPABASE_URL', 'SUPABASE_URL'],
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    fallbacks: ['VITE_SUPABASE_ANON_KEY'],
  },
  {
    key: 'NEXT_PUBLIC_AGENTS_URL',
    fallbacks: ['VITE_AGENTS_URL', 'VITE_API_AGENTS_URL', 'PUBLIC_AGENTS_URL', 'AGENTS_URL'],
  },
];

const serverKeyMappings: EnvKeyMapping[] = [
  ...clientKeyMappings,
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    fallbacks: ['SUPABASE_SERVICE_KEY', 'SERVICE_ROLE_KEY'],
  },
  {
    key: 'NEXT_PUBLIC_APP_URL',
    fallbacks: ['APP_BASE_URL'],
  },
];

const cleanValue = (value?: string) => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined') {
    return undefined;
  }
  return trimmed;
};

const readValue = (key: string, sources: EnvRecord[], fallbacks: string[] = []) => {
  for (const candidate of [key, ...fallbacks]) {
    for (const source of sources) {
      const raw = source?.[candidate];
      const value = cleanValue(raw);
      if (value !== undefined) {
        return value;
      }
    }
  }
  return undefined;
};

const buildRecord = (mappings: EnvKeyMapping[], sources: EnvRecord[]): EnvRecord => {
  return mappings.reduce<EnvRecord>((acc, mapping) => {
    acc[mapping.key] = readValue(mapping.key, sources, mapping.fallbacks);
    return acc;
  }, {});
};

const getProcessEnv = (): EnvRecord | undefined => {
  if (typeof process === 'undefined' || typeof process.env === 'undefined') {
    return undefined;
  }
  return process.env as EnvRecord;
};

export interface LoadEnvOptions {
  /** Primary environment variables to parse (for example `import.meta.env`). */
  env?: EnvRecord;
  /** Additional sources consulted when a value is missing from the primary environment. */
  fallbackEnvs?: EnvRecord[];
}

const collectSources = (options?: LoadEnvOptions): EnvRecord[] => {
  const sources: EnvRecord[] = [];
  if (options?.env) {
    sources.push(options.env);
  }
  if (options?.fallbackEnvs?.length) {
    sources.push(...options.fallbackEnvs);
  }
  const processEnv = getProcessEnv();
  if (processEnv) {
    sources.push(processEnv);
  }
  return sources;
};

const formatIssues = (issues: z.ZodIssue[]) =>
  issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('\n');

export const parseClientEnv = (env: EnvRecord): ClientEnv => {
  const result = clientEnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid client environment configuration:\n${formatIssues(result.error.issues)}`);
  }
  return result.data;
};

export const parseServerEnv = (env: EnvRecord): ServerEnv => {
  const result = serverEnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid server environment configuration:\n${formatIssues(result.error.issues)}`);
  }
  return result.data;
};

export const loadClientEnv = (options?: LoadEnvOptions): ClientEnv => {
  const sources = collectSources(options);
  const env = buildRecord(clientKeyMappings, sources);
  return parseClientEnv(env);
};

export const loadServerEnv = (options?: LoadEnvOptions): ServerEnv => {
  const sources = collectSources(options);
  const env = buildRecord(serverKeyMappings, sources);
  return parseServerEnv(env);
};

export const resolveClientEnv = loadClientEnv;
export const resolveServerEnv = loadServerEnv;
