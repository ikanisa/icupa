import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RateLimitSource = "disabled" | "memory" | "upstash";

export type RateLimitOutcome = {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number | null;
  source: RateLimitSource;
};

const windowSeconds = Math.max(
  1,
  Number.parseInt(process.env.LEADS_RATE_LIMIT_WINDOW_SECONDS ?? "60", 10) || 60,
);

const maxRequests = Math.max(
  1,
  Number.parseInt(process.env.LEADS_RATE_LIMIT_MAX ?? "5", 10) || 5,
);

const prefix = process.env.LEADS_RATE_LIMIT_PREFIX ?? "marketing:lead";

let upstashLimiter: Ratelimit | undefined;

const memoryHits = new Map<string, { count: number; expiresAt: number }>();

function ensureLimiter(): Ratelimit | undefined {
  if (upstashLimiter) return upstashLimiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return undefined;

  upstashLimiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
    prefix,
  });

  return upstashLimiter;
}

function msUntilReset(reset: number): number {
  const now = Date.now();
  const value = reset < 1_000_000_000_000 ? reset * 1000 : reset;
  return Math.max(0, value - now);
}

function buildOutcome(params: {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number | null;
  source: RateLimitSource;
}): RateLimitOutcome {
  return params;
}

export async function enforceLeadRateLimit(key: string): Promise<RateLimitOutcome> {
  const limiter = ensureLimiter();

  if (!limiter) {
    const now = Date.now();
    const bucket = memoryHits.get(key);

    if (!bucket || bucket.expiresAt <= now) {
      memoryHits.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
      return buildOutcome({
        allowed: true,
        limit: maxRequests,
        remaining: maxRequests - 1,
        reset: now + windowSeconds * 1000,
        retryAfter: null,
        source: "memory",
      });
    }

    if (bucket.count < maxRequests) {
      bucket.count += 1;
      return buildOutcome({
        allowed: true,
        limit: maxRequests,
        remaining: maxRequests - bucket.count,
        reset: bucket.expiresAt,
        retryAfter: null,
        source: "memory",
      });
    }

    const retryAfter = bucket.expiresAt - now;
    return buildOutcome({
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      reset: bucket.expiresAt,
      retryAfter,
      source: "memory",
    });
  }

  const result = await limiter.limit(`${key}`);
  const retryAfter = result.success ? null : msUntilReset(result.reset);

  return buildOutcome({
    allowed: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset < 1_000_000_000_000 ? result.reset * 1000 : result.reset,
    retryAfter,
    source: "upstash",
  });
}
