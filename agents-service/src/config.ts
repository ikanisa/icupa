import { z } from 'zod';

export interface ServiceConfig {
  host: string;
  port: number;
  region: string;
  openai: {
    apiKey: string;
    baseUrl?: string;
    defaultModel: string;
    lowCostModel: string;
    failoverModel: string;
    responsesApi: boolean;
    vectorStoreIds: string[];
  };
  supabase: {
    url: string;
    serviceRoleKey: string;
  };
  telemetry: {
    sessionBudgetUsd: number;
    dailyBudgetUsd: number;
  };
  retrieval: {
    freshnessMs: number;
  };
}

const DEFAULT_PORT = 8787;
const MIN_PORT = 1;
const MAX_PORT = 65535;
const DEFAULT_MODEL = 'gpt-4.1';
const DEFAULT_LOW_COST_MODEL = 'gpt-4o-mini';
const DEFAULT_FAILOVER_MODEL = 'gpt-4o-mini';
const DEFAULT_SESSION_BUDGET_USD = 0.75;
const DEFAULT_DAILY_BUDGET_USD = 50;
const RETRIEVAL_TTL_MS = 5 * 60 * 1000; // five minutes

const envSchema = z.object({
  AGENTS_HOST: z.string().optional().default('0.0.0.0'),
  AGENTS_PORT: z
    .string()
    .optional()
    .transform((value) => {
      if (!value || value.trim().length === 0) {
        return DEFAULT_PORT;
      }

      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < MIN_PORT || parsed > MAX_PORT) {
        throw new Error(
          `Invalid AGENTS_PORT "${value}". Please provide an integer between ${MIN_PORT} and ${MAX_PORT}.`
        );
      }

      return parsed;
    }),
  ICUPA_REGION: z
    .string()
    .optional()
    .transform((value) => (value && value.trim().length > 0 ? value.trim().toUpperCase() : 'EU')),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_DEFAULT_MODEL: z.string().optional(),
  OPENAI_LOW_COST_MODEL: z.string().optional(),
  OPENAI_FAILOVER_MODEL: z.string().optional(),
  OPENAI_USE_RESPONSES_API: z
    .string()
    .optional()
    .transform((value) => {
      if (typeof value === 'undefined') return true;
      return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase());
    }),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  AGENTS_MENU_VECTOR_STORE_ID: z.string().optional(),
  AGENTS_ALLERGENS_VECTOR_STORE_ID: z.string().optional(),
  AGENTS_POLICIES_VECTOR_STORE_ID: z.string().optional(),
  AGENT_SESSION_BUDGET_USD: z.string().optional(),
  AGENT_DAILY_BUDGET_USD: z.string().optional()
});

function parseBudget(value: string | undefined, fallback: number): number {
  if (!value || value.trim().length === 0) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid budget value "${value}". Provide a non-negative number.`);
  }

  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServiceConfig {
  const parsed = envSchema.parse(env);

  const vectorStoreIds = [
    parsed.AGENTS_MENU_VECTOR_STORE_ID,
    parsed.AGENTS_ALLERGENS_VECTOR_STORE_ID,
    parsed.AGENTS_POLICIES_VECTOR_STORE_ID
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return {
    host: parsed.AGENTS_HOST,
    port: parsed.AGENTS_PORT ?? DEFAULT_PORT,
    region: parsed.ICUPA_REGION,
    openai: {
      apiKey: parsed.OPENAI_API_KEY,
    baseUrl: parsed.OPENAI_BASE_URL,
    defaultModel: parsed.OPENAI_DEFAULT_MODEL?.trim() || DEFAULT_MODEL,
    lowCostModel:
      parsed.OPENAI_LOW_COST_MODEL?.trim() ||
      parsed.OPENAI_DEFAULT_MODEL?.trim() ||
      DEFAULT_LOW_COST_MODEL,
    failoverModel:
      parsed.OPENAI_FAILOVER_MODEL?.trim() ||
      parsed.OPENAI_LOW_COST_MODEL?.trim() ||
      parsed.OPENAI_DEFAULT_MODEL?.trim() ||
      DEFAULT_FAILOVER_MODEL,
      responsesApi: parsed.OPENAI_USE_RESPONSES_API ?? true,
      vectorStoreIds
    },
    supabase: {
      url: parsed.SUPABASE_URL,
      serviceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY
    },
    telemetry: {
      sessionBudgetUsd: parseBudget(parsed.AGENT_SESSION_BUDGET_USD, DEFAULT_SESSION_BUDGET_USD),
      dailyBudgetUsd: parseBudget(parsed.AGENT_DAILY_BUDGET_USD, DEFAULT_DAILY_BUDGET_USD)
    },
    retrieval: {
      freshnessMs: RETRIEVAL_TTL_MS
    }
  };
}
