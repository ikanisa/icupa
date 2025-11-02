import type { FeatureFlagPayload, FeatureFlagState } from '../../../../lib/types';

const TOOL_COPY: Record<string, string> = {
  get_menu: 'Retrieve menu catalog items',
  check_allergens: 'Cross-check allergen guardrails',
  recommend_items: 'Suggest pairings to diners',
  create_order: 'Create orders via agents service',
  get_kitchen_load: 'Read current kitchen pacing',
  alerts_dispatch: 'Dispatch alerts to operators',
  reports_generate: 'Generate compliance reports',
};

function normaliseAudience(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  return [];
}

function normaliseMetadata(metadata: any) {
  if (metadata && typeof metadata === 'object') {
    return metadata as Record<string, unknown>;
  }
  return {};
}

export function mapFeatureFlagRow(row: any): FeatureFlagState {
  const metadata = normaliseMetadata(row.metadata);
  const key = (metadata.key as string) ?? (row.agent_type as string);
  const label = (metadata.label as string) ?? key;
  const description =
    (metadata.description as string) ??
    (typeof row.instructions === 'string' && row.instructions.length > 0
      ? row.instructions
      : 'Runtime configuration managed via admin console.');

  return {
    id: row.id as string,
    key,
    label,
    description,
    enabled: Boolean(row.enabled),
    audience: normaliseAudience(metadata.audience),
    tenantId: (row.tenant_id as string) ?? null,
    experimentFlag: (row.experiment_flag as string) ?? null,
    syncPending: Boolean(row.sync_pending),
    updatedAt: row.updated_at ?? new Date().toISOString(),
    autonomyLevel: ((level: string) => {
      switch (level) {
        case 'L3':
          return 3;
        case 'L2':
          return 2;
        case 'L1':
          return 1;
        default:
          return 0;
      }
    })(row.autonomy_level as string),
    sessionBudgetUsd: Number(row.session_budget_usd ?? 0),
    dailyBudgetUsd: Number(row.daily_budget_usd ?? 0),
    instructions: typeof row.instructions === 'string' ? row.instructions : '',
  };
}

export function buildFeatureFlagInsert(payload: FeatureFlagPayload, actorId: string) {
  return {
    tenant_id: payload.tenantId,
    agent_type: payload.key,
    enabled: payload.enabled,
    session_budget_usd: payload.sessionBudgetUsd,
    daily_budget_usd: payload.dailyBudgetUsd,
    instructions: payload.instructions,
    autonomy_level: `L${payload.autonomyLevel}`,
    experiment_flag: payload.experimentFlag ?? null,
    updated_by: actorId,
    metadata: {
      key: payload.key,
      label: payload.label,
      description: payload.description,
      audience: payload.audience,
    },
    tool_allowlist: payload.audience.includes('ops') ? ['alerts_dispatch', 'reports_generate'] : ['get_menu', 'check_allergens', 'recommend_items'],
  };
}

export function buildFeatureFlagUpdate(payload: Partial<FeatureFlagPayload>, actorId: string) {
  const update: Record<string, unknown> = { updated_by: actorId };

  if (payload.enabled !== undefined) {
    update.enabled = payload.enabled;
  }
  if (payload.sessionBudgetUsd !== undefined) {
    update.session_budget_usd = payload.sessionBudgetUsd;
  }
  if (payload.dailyBudgetUsd !== undefined) {
    update.daily_budget_usd = payload.dailyBudgetUsd;
  }
  if (payload.instructions !== undefined) {
    update.instructions = payload.instructions;
  }
  if (payload.autonomyLevel !== undefined) {
    update.autonomy_level = `L${payload.autonomyLevel}`;
  }
  if (payload.experimentFlag !== undefined) {
    update.experiment_flag = payload.experimentFlag ?? null;
  }
  if (payload.audience || payload.label || payload.description) {
    update.metadata = {
      ...(payload.key ? { key: payload.key } : {}),
      ...(payload.label ? { label: payload.label } : {}),
      ...(payload.description ? { description: payload.description } : {}),
      ...(payload.audience ? { audience: payload.audience } : {}),
    };
  }

  return update;
}

export function describeTool(name: string) {
  return TOOL_COPY[name] ?? 'Agent capability toggle';
}
