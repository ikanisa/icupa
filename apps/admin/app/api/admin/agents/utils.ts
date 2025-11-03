import type { AgentSetting, AgentToolSetting, AgentAutonomyCode } from '../../../../lib/types';
import { describeTool, mapFeatureFlagRow } from '../feature-flags/utils';

const DEFAULT_TOOL_SET = ['get_menu', 'check_allergens', 'recommend_items', 'create_order', 'get_kitchen_load'];

export function mapAgentConfigRow(row: any): AgentSetting {
  const base = mapFeatureFlagRow(row);
  const allowList: string[] = Array.isArray(row.tool_allowlist)
    ? row.tool_allowlist.map((tool: any) => String(tool))
    : [];

  const catalog: AgentToolSetting[] = (row.metadata?.tools as AgentToolSetting[] | undefined)?.map((tool) => ({
    ...tool,
    enabled: allowList.includes(tool.name),
  })) ??
    DEFAULT_TOOL_SET.map((name) => ({
      name,
      description: describeTool(name),
      enabled: allowList.includes(name),
    }));

  return {
    id: row.id as string,
    tenantId: (row.tenant_id as string) ?? null,
    agentType: row.agent_type as string,
    title: base.label,
    description: base.description,
    autonomy: base.autonomyLevel,
    sessionBudgetUsd: base.sessionBudgetUsd,
    dailyBudgetUsd: base.dailyBudgetUsd,
    instructions: base.instructions,
    tools: catalog,
    experimentFlag: base.experimentFlag,
    lastUpdated: base.updatedAt,
    syncPending: base.syncPending,
  };
}

export function buildAgentConfigUpdate(setting: Partial<AgentSetting>, actorId: string) {
  const update: Record<string, unknown> = { updated_by: actorId };

  if (setting.autonomy !== undefined) {
    update.autonomy_level = `L${setting.autonomy}` as AgentAutonomyCode;
  }
  if (setting.sessionBudgetUsd !== undefined) {
    update.session_budget_usd = setting.sessionBudgetUsd;
  }
  if (setting.dailyBudgetUsd !== undefined) {
    update.daily_budget_usd = setting.dailyBudgetUsd;
  }
  if (setting.instructions !== undefined) {
    update.instructions = setting.instructions;
  }
  if (setting.experimentFlag !== undefined) {
    update.experiment_flag = setting.experimentFlag ?? null;
  }
  if (setting.tools) {
    update.tool_allowlist = setting.tools.filter((tool) => tool.enabled).map((tool) => tool.name);
    update.metadata = {
      ...(setting.tools ? { tools: setting.tools.map((tool) => ({ name: tool.name, description: tool.description, enabled: tool.enabled })) } : {}),
    };
  }

  return update;
}
