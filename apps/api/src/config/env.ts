import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  PAYMENT_PROVIDER: z.enum(['stripe', 'mock']).default('mock'),
  SEARCH_PROVIDER: z.enum(['algolia', 'mock']).default('mock'),
  MESSAGING_PROVIDER: z.enum(['twilio', 'mock']).default('mock'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OPENAPI_OUTPUT_PATH: z.string().default('apps/api/spec/openapi.json')
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
