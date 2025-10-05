import { supabaseClient } from '../supabase';
import { loadConfig } from '../config';
import type { AgentSessionContext, UpsellSuggestion } from '../agents/types';
import { redactSensitiveText, truncateForTelemetry } from '../utils/pii';
import { estimateCostUsd } from '../utils/pricing';

const config = loadConfig();
const runtimeConfigCache = new Map<string, { expiresAt: number; value: RuntimeConfig }>();
const RUNTIME_CONFIG_TTL_MS = 60_000;

export type RuntimeConfig = {
  id: string | null;
  enabled: boolean;
  sessionBudgetUsd: number;
  dailyBudgetUsd: number;
  instructions: string;
  toolAllowlist: string[];
  autonomyLevel: 'L0' | 'L1' | 'L2' | 'L3';
  retrievalTtlMinutes: number;
  experimentFlag: string | null;
  syncPending: boolean;
};

type AgentRuntimeConfigRow = {
  id: string | null;
  tenant_id: string | null;
  agent_type: string;
  enabled: boolean;
  session_budget_usd: string | number | null;
  daily_budget_usd: string | number | null;
  instructions?: string | null;
  tool_allowlist?: string[] | null;
  autonomy_level?: 'L0' | 'L1' | 'L2' | 'L3' | null;
  retrieval_ttl_minutes?: number | null;
  experiment_flag?: string | null;
  sync_pending?: boolean | null;
};

function toRuntimeConfig(row?: AgentRuntimeConfigRow | null): RuntimeConfig {
  if (!row) {
    return {
      id: null,
      enabled: true,
      sessionBudgetUsd: config.telemetry.sessionBudgetUsd,
      dailyBudgetUsd: config.telemetry.dailyBudgetUsd,
      instructions: 'Follow tenant brand guardrails and cite sources.',
      toolAllowlist: [],
      autonomyLevel: 'L0',
      retrievalTtlMinutes: Math.ceil(config.retrieval.freshnessMs / 60_000),
      experimentFlag: null,
      syncPending: false
    };
  }

  return {
    id: row.id ?? null,
    enabled: row.enabled,
    sessionBudgetUsd:
      typeof row.session_budget_usd === 'number'
        ? row.session_budget_usd
        : Number(row.session_budget_usd ?? config.telemetry.sessionBudgetUsd),
    dailyBudgetUsd:
      typeof row.daily_budget_usd === 'number'
        ? row.daily_budget_usd
        : Number(row.daily_budget_usd ?? config.telemetry.dailyBudgetUsd),
    instructions: (row.instructions ?? '').trim() || 'Follow tenant brand guardrails and cite sources.',
    toolAllowlist: Array.isArray(row.tool_allowlist) ? row.tool_allowlist : [],
    autonomyLevel: row.autonomy_level ?? 'L0',
    retrievalTtlMinutes:
      typeof row.retrieval_ttl_minutes === 'number'
        ? Math.max(1, row.retrieval_ttl_minutes)
        : Math.ceil(config.retrieval.freshnessMs / 60_000),
    experimentFlag: row.experiment_flag ?? null,
    syncPending: Boolean(row.sync_pending)
  };
}

function runtimeCacheKey(agentType: string, tenantId?: string) {
  return `${agentType}:${tenantId ?? 'global'}`;
}

async function fetchRuntimeConfig(agentType: string, tenantId?: string): Promise<RuntimeConfig> {
  const cacheKey = runtimeCacheKey(agentType, tenantId);
  const cached = runtimeConfigCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const query = supabaseClient
    .from('agent_runtime_configs')
    .select(
      'id, tenant_id, agent_type, enabled, session_budget_usd, daily_budget_usd, instructions, tool_allowlist, autonomy_level, retrieval_ttl_minutes, experiment_flag, sync_pending'
    )
    .eq('agent_type', agentType)
    .order('tenant_id', { ascending: false });

  if (tenantId) {
    query.eq('tenant_id', tenantId);
  } else {
    query.is('tenant_id', null);
  }

  const { data, error } = await query.maybeSingle();
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Unable to load agent runtime config: ${error.message}`);
  }

  let value = toRuntimeConfig(data ?? undefined);

  if (!data && tenantId) {
    // fallback to global defaults if tenant override absent
    value = await fetchRuntimeConfig(agentType, undefined);
    runtimeConfigCache.set(cacheKey, { value, expiresAt: now + RUNTIME_CONFIG_TTL_MS });
    return value;
  }

  runtimeConfigCache.set(cacheKey, { value, expiresAt: now + RUNTIME_CONFIG_TTL_MS });
  return value;
}

function startOfToday(): string {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return now.toISOString();
}

async function getDailySpend(agentType: string, tenantId?: string): Promise<number> {
  const query = supabaseClient
    .from('agent_events')
    .select('total:sum(cost_usd)')
    .eq('agent_type', agentType)
    .gte('created_at', startOfToday());

  if (tenantId) {
    query.eq('tenant_id', tenantId);
  } else {
    query.is('tenant_id', null);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`Failed to compute agent spend: ${error.message}`);
  }

  const total = data?.total ?? 0;
  return Number(total) || 0;
}

async function acknowledgeRuntimeSync(
  agentType: string,
  tenantId: string | undefined,
  runtime: RuntimeConfig
) {
  if (!runtime.id || !runtime.syncPending) {
    return;
  }

  const { error } = await supabaseClient.rpc('ack_agent_runtime_config', { config_id: runtime.id });
  if (error) {
    console.warn('Failed to acknowledge agent runtime config sync', {
      agentType,
      tenantId,
      error: error.message
    });
    return;
  }

  runtime.syncPending = false;
  runtimeConfigCache.set(runtimeCacheKey(agentType, tenantId), {
    value: runtime,
    expiresAt: Date.now() + RUNTIME_CONFIG_TTL_MS
  });
}

export async function ensureAgentEnabled(agentType: string, tenantId?: string): Promise<RuntimeConfig> {
  const runtime = await fetchRuntimeConfig(agentType, tenantId);
  if (!runtime.enabled) {
    throw new Error(`Agent ${agentType} is currently disabled by an administrator.`);
  }

  if (runtime.dailyBudgetUsd > 0) {
    const spent = await getDailySpend(agentType, tenantId);
    if (spent >= runtime.dailyBudgetUsd) {
      throw new Error(`Daily budget exhausted for agent ${agentType}.`);
    }
  }

  await acknowledgeRuntimeSync(agentType, tenantId, runtime);

  return runtime;
}

export async function assertBudgetsAfterRun(
  agentType: string,
  tenantId: string | undefined,
  runtimeConfig: RuntimeConfig,
  costUsd: number
): Promise<void> {
  if (runtimeConfig.sessionBudgetUsd > 0 && costUsd > runtimeConfig.sessionBudgetUsd) {
    throw new Error(`Agent ${agentType} exceeded per-session budget (${runtimeConfig.sessionBudgetUsd} USD).`);
  }

  if (runtimeConfig.dailyBudgetUsd > 0) {
    const spent = await getDailySpend(agentType, tenantId);
    if (spent + costUsd > runtimeConfig.dailyBudgetUsd) {
      throw new Error(`Agent ${agentType} would exceed the daily budget (${runtimeConfig.dailyBudgetUsd} USD).`);
    }
  }
}

export async function createAgentSessionRecord(
  agentType: string,
  context: AgentSessionContext,
  runtime?: RuntimeConfig
): Promise<string> {
  const { data, error } = await supabaseClient
    .from('agent_sessions')
    .insert({
      agent_type: agentType,
      tenant_id: context.tenantId ?? null,
      location_id: context.locationId ?? null,
      table_session_id: context.tableSessionId ?? null,
      user_id: context.userId ?? null,
      context: {
        allergies: context.allergies,
        language: context.language,
        region: context.region,
        autonomy_level: runtime?.autonomyLevel ?? null,
        experiment_flag: runtime?.experimentFlag ?? null
      }
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create agent session: ${error.message}`);
  }

  return data.id;
}

export async function logAgentEvent(params: {
  agentType: string;
  context: AgentSessionContext;
  sessionId: string;
  input: string;
  output: string;
  toolsUsed: string[];
  startedAt: number;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}): Promise<number> {
  const latencyMs = Date.now() - params.startedAt;
  const cost = estimateCostUsd(params.model, params.usage);

  const { error } = await supabaseClient.from('agent_events').insert({
    agent_type: params.agentType,
    session_id: params.sessionId,
    tenant_id: params.context.tenantId ?? null,
    location_id: params.context.locationId ?? null,
    table_session_id: params.context.tableSessionId ?? null,
    input: {
      message: truncateForTelemetry(redactSensitiveText(params.input))
    },
    output: {
      message: truncateForTelemetry(redactSensitiveText(params.output))
    },
    tools_used: params.toolsUsed,
    latency_ms: latencyMs,
    cost_usd: cost
  });

  if (error) {
    throw new Error(`Unable to record agent event: ${error.message}`);
  }

  return cost;
}

export async function recordRecommendationImpressions(
  context: AgentSessionContext,
  sessionId: string,
  suggestions: UpsellSuggestion[]
): Promise<UpsellSuggestion[]> {
  if (!suggestions.length) return suggestions;

  const rows = suggestions.map((suggestion) => ({
    session_id: sessionId,
    tenant_id: context.tenantId ?? null,
    location_id: context.locationId ?? null,
    item_id: suggestion.item_id,
    rationale: suggestion.rationale,
    accepted: false
  }));

  const { data, error } = await supabaseClient
    .from('recommendation_impressions')
    .insert(rows)
    .select('id, item_id');

  if (error) {
    throw new Error(`Failed to record recommendation impressions: ${error.message}`);
  }

  const impressionMap = new Map<string, string[]>();
  for (const entry of data ?? []) {
    if (!entry?.id || !entry?.item_id) continue;
    const key = entry.item_id as string;
    const existing = impressionMap.get(key) ?? [];
    existing.push(entry.id as string);
    impressionMap.set(key, existing);
  }

  return suggestions.map((suggestion) => {
    const queue = impressionMap.get(suggestion.item_id);
    const impressionId = queue?.shift();
    if (queue && queue.length === 0) {
      impressionMap.delete(suggestion.item_id);
    }

    return impressionId
      ? { ...suggestion, impression_id: impressionId }
      : suggestion;
  });
}
