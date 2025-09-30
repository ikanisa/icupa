import { supabaseClient } from '../supabase';
import { loadConfig } from '../config';
import type { AgentSessionContext, UpsellSuggestion } from '../agents/types';
import { redactSensitiveText, truncateForTelemetry } from '../utils/pii';
import { estimateCostUsd } from '../utils/pricing';

const config = loadConfig();
const runtimeConfigCache = new Map<string, { expiresAt: number; value: RuntimeConfig }>();
const RUNTIME_CONFIG_TTL_MS = 60_000;

export type RuntimeConfig = {
  enabled: boolean;
  sessionBudgetUsd: number;
  dailyBudgetUsd: number;
};

type AgentRuntimeConfigRow = {
  tenant_id: string | null;
  agent_type: string;
  enabled: boolean;
  session_budget_usd: string | number | null;
  daily_budget_usd: string | number | null;
};

function toRuntimeConfig(row?: AgentRuntimeConfigRow | null): RuntimeConfig {
  if (!row) {
    return {
      enabled: true,
      sessionBudgetUsd: config.telemetry.sessionBudgetUsd,
      dailyBudgetUsd: config.telemetry.dailyBudgetUsd
    };
  }

  return {
    enabled: row.enabled,
    sessionBudgetUsd:
      typeof row.session_budget_usd === 'number'
        ? row.session_budget_usd
        : Number(row.session_budget_usd ?? config.telemetry.sessionBudgetUsd),
    dailyBudgetUsd:
      typeof row.daily_budget_usd === 'number'
        ? row.daily_budget_usd
        : Number(row.daily_budget_usd ?? config.telemetry.dailyBudgetUsd)
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
    .select('tenant_id, agent_type, enabled, session_budget_usd, daily_budget_usd')
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
  context: AgentSessionContext
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
        region: context.region
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
): Promise<void> {
  if (!suggestions.length) return;

  const rows = suggestions.map((suggestion) => ({
    session_id: sessionId,
    tenant_id: context.tenantId ?? null,
    location_id: context.locationId ?? null,
    item_id: suggestion.item_id,
    rationale: suggestion.rationale,
    accepted: false
  }));

  const { error } = await supabaseClient.from('recommendation_impressions').insert(rows);
  if (error) {
    throw new Error(`Failed to record recommendation impressions: ${error.message}`);
  }
}

export async function recordAgentFeedback(params: {
  agentType: string;
  sessionId: string;
  rating: 'up' | 'down';
  messageId?: string;
  tenantId?: string;
  locationId?: string;
  tableSessionId?: string;
}): Promise<void> {
  const { error } = await supabaseClient.from('agent_events').insert({
    agent_type: params.agentType,
    session_id: params.sessionId,
    tenant_id: params.tenantId ?? null,
    location_id: params.locationId ?? null,
    table_session_id: params.tableSessionId ?? null,
    input: {
      message: 'feedback',
      rating: params.rating,
      message_id: params.messageId ?? null,
    },
    output: {
      acknowledged: true,
    },
    tools_used: [],
    latency_ms: 0,
    cost_usd: 0,
  });

  if (error) {
    throw new Error(`Unable to record agent feedback: ${error.message}`);
  }
}
