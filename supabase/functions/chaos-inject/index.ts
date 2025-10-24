import policyFixture from "../../../ops/fixtures/chaos_policy_map.json" with { type: "json" };

import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { getSupabaseServiceConfig } from "../_shared/env.ts";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } = getSupabaseServiceConfig({ feature: "chaos-inject" });

const JSON_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

interface ChaosPolicyFixture {
  key?: string;
  target?: string;
  mode?: string;
  fallback?: string | null;
  enabled?: boolean;
  notes?: string | null;
  expires_at?: string | null;
  source?: string;
  updated_at?: string;
}

interface ChaosPolicy extends Required<Omit<ChaosPolicyFixture, "expires_at" | "fallback" | "notes" | "enabled" | "source">> {
  fallback: string | null;
  enabled: boolean;
  notes: string | null;
  expires_at: string | null;
  source: "memory" | "database" | "fixture" | "env";
  updated_at: string;
}

const FIXTURE_POLICIES: ChaosPolicyFixture[] = Array.isArray(policyFixture)
  ? policyFixture as ChaosPolicyFixture[]
  : [];

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("chaos-inject");
  }

  if (req.method !== "GET") {
    return respond({ ok: false, error: "GET only" }, 405);
  }

  const includeDisabled = url.searchParams.get("include_disabled") === "1";

  const policies = await collectPolicies({ includeDisabled });
  const active = policies.filter((policy) => includeDisabled || policy.enabled);

  const result = dedupePolicies(active);

  return respond({
    ok: true,
    request_id: requestId,
    generated_at: new Date().toISOString(),
    source: classifySource(result),
    total: result.length,
    policies: result,
  });
}, { fn: "chaos-inject", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

async function collectPolicies(options: { includeDisabled: boolean }): Promise<ChaosPolicy[]> {
  const fromMemory = loadMemoryPolicies();
  const fromEnv = loadEnvPolicies();
  const database = await loadDatabasePolicies();

  const combined = [...fromMemory, ...fromEnv, ...database];

  if (options.includeDisabled) {
    return combined;
  }

  const now = Date.now();
  return combined.filter((policy) => {
    if (!policy.enabled) return false;
    if (!policy.expires_at) return true;
    const expires = Date.parse(policy.expires_at);
    if (Number.isNaN(expires)) return true;
    return expires > now;
  });
}

function loadMemoryPolicies(): ChaosPolicy[] {
  const useFixtures = (Deno.env.get("CHAOS_INJECT_FIXTURES") ?? "0") === "1";
  if (!useFixtures) return [];
  return FIXTURE_POLICIES.map((entry) => normalizePolicy(entry, "fixture"));
}

function loadEnvPolicies(): ChaosPolicy[] {
  const raw = Deno.env.get("CHAOS_INJECT_MEMORY");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => normalizePolicy(entry as ChaosPolicyFixture, "env"));
  } catch (error) {
    console.warn("chaos-inject: failed to parse CHAOS_INJECT_MEMORY", error);
    return [];
  }
}

async function loadDatabasePolicies(): Promise<ChaosPolicy[]> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/ops_chaos_policies?select=key,target,mode,fallback,enabled,notes,expires_at,updated_at`,
      { headers: JSON_HEADERS },
    );
    if (!response.ok) {
      const text = await response.text();
      console.warn("chaos-inject: database policies fetch failed", { status: response.status, text });
      return [];
    }
    const data = await response.json() as Array<ChaosPolicyFixture & { updated_at?: string }>;
    return data.map((row) => normalizePolicy({ ...row, source: "database" }, "database"));
  } catch (error) {
    console.warn("chaos-inject: database request errored", error);
    return [];
  }
}

function normalizePolicy(entry: ChaosPolicyFixture, source: ChaosPolicy["source"]): ChaosPolicy {
  return {
    key: entry.key ?? crypto.randomUUID(),
    target: entry.target ?? "unknown",
    mode: entry.mode ?? "force_failure",
    fallback: entry.fallback ?? null,
    enabled: entry.enabled ?? false,
    notes: entry.notes ?? null,
    expires_at: entry.expires_at ?? null,
    source,
    updated_at: entry.updated_at ?? new Date().toISOString(),
  };
}

function dedupePolicies(policies: ChaosPolicy[]): ChaosPolicy[] {
  const byKey = new Map<string, ChaosPolicy>();
  for (const policy of policies) {
    const existing = byKey.get(policy.key);
    if (!existing) {
      byKey.set(policy.key, policy);
      continue;
    }
    if (priority(existing.source) <= priority(policy.source)) {
      byKey.set(policy.key, policy);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function priority(source: ChaosPolicy["source"]): number {
  switch (source) {
    case "database":
      return 3;
    case "env":
      return 2;
    case "fixture":
      return 1;
    default:
      return 0;
  }
}

function classifySource(policies: ChaosPolicy[]): "database" | "memory" | "fixtures" | "mixed" {
  const sources = new Set(policies.map((policy) => policy.source));
  if (sources.size === 0) return "memory";
  if (sources.size === 1) {
    const [only] = Array.from(sources);
    if (only === "fixture") return "fixtures";
    if (only === "env") return "memory";
    return only;
  }
  return "mixed";
}

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
