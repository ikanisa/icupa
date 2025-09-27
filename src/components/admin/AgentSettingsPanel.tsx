import { useEffect, useState } from "react";
import { AgentConfig, UpdateAgentConfigInput, useAgentConfigs, useUpdateAgentConfig } from "@/hooks/useAgentConfigs";
import { useAgentConfigAudits } from "@/hooks/useAgentConfigAudits";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { AgentActionQueue } from "@/components/admin/AgentActionQueue";

interface AgentSettingsPanelProps {
  tenantId: string | null;
}

interface AgentConfigFormState {
  enabled: boolean;
  instructions: string;
  toolAllowlistInput: string;
  sessionBudgetUsd: string;
  dailyBudgetUsd: string;
  autonomyLevel: AgentConfig["autonomyLevel"];
  retrievalTtlMinutes: string;
  experimentFlag: string;
}

function createInitialState(config: AgentConfig): AgentConfigFormState {
  return {
    enabled: config.enabled,
    instructions: config.instructions,
    toolAllowlistInput: config.toolAllowlist.join(", "),
    sessionBudgetUsd: config.sessionBudgetUsd.toString(),
    dailyBudgetUsd: config.dailyBudgetUsd.toString(),
    autonomyLevel: config.autonomyLevel,
    retrievalTtlMinutes: config.retrievalTtlMinutes.toString(),
    experimentFlag: config.experimentFlag ?? "",
  };
}

interface AgentConfigCardProps {
  tenantId: string;
  config: AgentConfig;
  onSave: (payload: UpdateAgentConfigInput) => void;
  isSaving: boolean;
}

function AgentConfigCard({ tenantId, config, onSave, isSaving }: AgentConfigCardProps) {
  const [state, setState] = useState<AgentConfigFormState>(() => createInitialState(config));
  const { data: audits, isLoading: isAuditLoading } = useAgentConfigAudits(config.id);

  useEffect(() => {
    setState(createInitialState(config));
  }, [config]);

  const parsedAllowlist = state.toolAllowlistInput
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  function handleSubmit() {
    onSave({
      id: config.id,
      tenantId,
      patch: {
        enabled: state.enabled,
        instructions: state.instructions.trim(),
        toolAllowlist: parsedAllowlist,
        sessionBudgetUsd: Number(state.sessionBudgetUsd) || 0,
        dailyBudgetUsd: Number(state.dailyBudgetUsd) || 0,
        autonomyLevel: state.autonomyLevel,
        retrievalTtlMinutes: Number(state.retrievalTtlMinutes) || 5,
        experimentFlag: state.experimentFlag.trim() || null,
      },
    });
  }

  return (
    <Card className="glass-card flex flex-col gap-4 border border-white/10 bg-white/10 p-5 text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/60">Agent</p>
          <h3 className="text-xl font-semibold capitalize">{config.agentType.replace(/_/g, " ")}</h3>
          <p className="text-xs text-white/60">Updated {new Date(config.updatedAt).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-3">
          {config.syncPending ? <Badge variant="outline" className="border-amber-300 text-amber-200">Sync pending</Badge> : <Badge className="bg-emerald-500/20 text-emerald-100">Synced</Badge>}
          <div className="flex items-center gap-2">
            <Label htmlFor={`${config.id}-enabled`} className="text-xs uppercase tracking-wide text-white/60">
              Enabled
            </Label>
            <Switch
              id={`${config.id}-enabled`}
              checked={state.enabled}
              onCheckedChange={(checked) => setState((prev) => ({ ...prev, enabled: checked }))}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <Label htmlFor={`${config.id}-instructions`} className="text-xs uppercase tracking-wide text-white/60">
          Instructions
        </Label>
        <Textarea
          id={`${config.id}-instructions`}
          value={state.instructions}
          onChange={(event) => setState((prev) => ({ ...prev, instructions: event.target.value }))}
          className="min-h-[100px] bg-white/10 text-sm text-white placeholder:text-white/50"
        />
      </div>

      <div className="grid gap-3">
        <Label htmlFor={`${config.id}-tools`} className="text-xs uppercase tracking-wide text-white/60">
          Tool allow-list
        </Label>
        <Input
          id={`${config.id}-tools`}
          value={state.toolAllowlistInput}
          onChange={(event) => setState((prev) => ({ ...prev, toolAllowlistInput: event.target.value }))}
          placeholder="get_menu, check_allergens"
          className="bg-white/10 text-white placeholder:text-white/50"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${config.id}-session-budget`} className="text-xs uppercase tracking-wide text-white/60">
            Session budget (USD)
          </Label>
          <Input
            id={`${config.id}-session-budget`}
            type="number"
            min="0"
            step="0.05"
            value={state.sessionBudgetUsd}
            onChange={(event) => setState((prev) => ({ ...prev, sessionBudgetUsd: event.target.value }))}
            className="bg-white/10 text-white placeholder:text-white/50"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${config.id}-daily-budget`} className="text-xs uppercase tracking-wide text-white/60">
            Daily budget (USD)
          </Label>
          <Input
            id={`${config.id}-daily-budget`}
            type="number"
            min="0"
            step="0.5"
            value={state.dailyBudgetUsd}
            onChange={(event) => setState((prev) => ({ ...prev, dailyBudgetUsd: event.target.value }))}
            className="bg-white/10 text-white placeholder:text-white/50"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-wide text-white/60">Autonomy</Label>
          <Select value={state.autonomyLevel} onValueChange={(value) => setState((prev) => ({ ...prev, autonomyLevel: value as AgentConfig["autonomyLevel"] }))}>
            <SelectTrigger className="bg-white/10 text-left text-white">
              <SelectValue placeholder="Select autonomy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="L0">L0 – Suggestions only</SelectItem>
              <SelectItem value="L1">L1 – One-tap approve</SelectItem>
              <SelectItem value="L2">L2 – Auto act within caps</SelectItem>
              <SelectItem value="L3">L3 – Multi-step</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${config.id}-ttl`} className="text-xs uppercase tracking-wide text-white/60">
            Retrieval TTL (minutes)
          </Label>
          <Input
            id={`${config.id}-ttl`}
            type="number"
            min="1"
            value={state.retrievalTtlMinutes}
            onChange={(event) => setState((prev) => ({ ...prev, retrievalTtlMinutes: event.target.value }))}
            className="bg-white/10 text-white placeholder:text-white/50"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${config.id}-experiment`} className="text-xs uppercase tracking-wide text-white/60">
            Experiment flag
          </Label>
          <Input
            id={`${config.id}-experiment`}
            value={state.experimentFlag}
            onChange={(event) => setState((prev) => ({ ...prev, experimentFlag: event.target.value }))}
            placeholder="baseline"
            className="bg-white/10 text-white placeholder:text-white/50"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          className="border-white/30 text-white hover:bg-white/20"
          onClick={() => setState(createInitialState(config))}
          disabled={isSaving}
        >
          Reset
        </Button>
        <Button
          type="button"
          className="rounded-2xl bg-white text-primary"
          onClick={handleSubmit}
          disabled={isSaving}
        >
          {isSaving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <div className="border-t border-white/10 pt-4">
        <p className="text-xs uppercase tracking-widest text-white/60">Recent changes</p>
        {isAuditLoading ? (
          <div className="mt-3 grid gap-2">
            <Skeleton className="h-12 w-full bg-white/10" />
            <Skeleton className="h-12 w-full bg-white/10" />
          </div>
        ) : audits && audits.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {audits.map((audit) => (
              <li key={audit.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide text-white/50">
                  <span>{new Date(audit.createdAt).toLocaleString()}</span>
                  <span>{audit.action.toUpperCase()}</span>
                </div>
                <p className="mt-2 text-sm text-white">{summariseAuditChanges(audit.beforeState, audit.afterState)}</p>
                <p className="mt-2 text-xs text-white/60">
                  Actor: {audit.changedBy ? truncateIdentifier(audit.changedBy) : "System"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-white/70">No audit entries recorded for this agent yet.</p>
        )}
      </div>
    </Card>
  );
}

export function AgentSettingsPanel({ tenantId }: AgentSettingsPanelProps) {
  const { data, isLoading, isError } = useAgentConfigs(tenantId);
  const updateMutation = useUpdateAgentConfig(tenantId);
  const { toast } = useToast();

  useEffect(() => {
    if (updateMutation.isError) {
      const message = updateMutation.error instanceof Error ? updateMutation.error.message : "Unexpected error";
      toast({ title: "Failed to save settings", description: message, variant: "destructive" });
    }
    if (updateMutation.isSuccess) {
      toast({ title: "Agent settings updated", description: "Changes will propagate to the agents service shortly." });
    }
  }, [updateMutation.isError, updateMutation.isSuccess, updateMutation.error, toast]);

  if (!tenantId) {
    return <p className="text-sm text-white/70">Select a tenant to manage agent configuration.</p>;
  }

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-48 w-full bg-white/10" />
        <Skeleton className="h-48 w-full bg-white/10" />
      </div>
    );
  }

  if (isError || !data || data.length === 0) {
    return <p className="text-sm text-white/70">No agent configurations found for this tenant.</p>;
  }

  return (
    <div className="grid gap-5">
      {data.map((config) => (
        <AgentConfigCard
          key={config.id}
          tenantId={tenantId}
          config={config}
          onSave={(payload) => updateMutation.mutate(payload)}
          isSaving={updateMutation.isPending}
        />
      ))}
      <AgentActionQueue tenantId={tenantId} />
    </div>
  );
}

const AUDIT_FIELD_MAP: Record<
  string,
  {
    label: string;
    normalize?: (value: unknown) => unknown;
    format?: (value: unknown) => string;
  }
> = {
  enabled: { label: "Enabled", format: (value) => (value ? "On" : "Off"), normalize: (value) => Boolean(value) },
  session_budget_usd: {
    label: "Session budget",
    normalize: (value) => Number(value ?? 0),
    format: (value) => `$${Number(value ?? 0).toFixed(2)}`,
  },
  daily_budget_usd: {
    label: "Daily budget",
    normalize: (value) => Number(value ?? 0),
    format: (value) => `$${Number(value ?? 0).toFixed(2)}`,
  },
  autonomy_level: { label: "Autonomy", normalize: (value) => String(value ?? ""), format: (value) => String(value ?? "") },
  retrieval_ttl_minutes: {
    label: "Retrieval TTL",
    normalize: (value) => Number(value ?? 0),
    format: (value) => `${Number(value ?? 0)} min`,
  },
  tool_allowlist: {
    label: "Tools",
    normalize: (value) => (Array.isArray(value) ? [...value].sort() : []),
    format: (value) => (Array.isArray(value) ? value.join(", ") : "—"),
  },
  experiment_flag: {
    label: "Experiment flag",
    normalize: (value) => String(value ?? ""),
    format: (value) => (value ? String(value) : "—"),
  },
  instructions: {
    label: "Instructions",
    normalize: (value) => String(value ?? ""),
    format: (value) => truncateInstructions(String(value ?? "")),
  },
};

function summariseAuditChanges(
  beforeState: Record<string, unknown> | null,
  afterState: Record<string, unknown>,
): string {
  const changes: string[] = [];

  for (const [key, meta] of Object.entries(AUDIT_FIELD_MAP)) {
    const beforeNormalized = meta.normalize ? meta.normalize(beforeState?.[key]) : beforeState?.[key];
    const afterNormalized = meta.normalize ? meta.normalize(afterState?.[key]) : afterState?.[key];

    if (isAuditValueEqual(beforeNormalized, afterNormalized)) {
      continue;
    }

    const beforeFormatted = meta.format ? meta.format(beforeNormalized) : formatDefault(beforeNormalized);
    const afterFormatted = meta.format ? meta.format(afterNormalized) : formatDefault(afterNormalized);

    if (beforeState === null) {
      changes.push(`${meta.label}: ${afterFormatted}`);
    } else {
      changes.push(`${meta.label}: ${beforeFormatted} → ${afterFormatted}`);
    }
  }

  if (changes.length === 0) {
    return beforeState === null ? "Configuration created." : "No tracked fields changed.";
  }

  return changes.join("; ");
}

function isAuditValueEqual(beforeValue: unknown, afterValue: unknown): boolean {
  if (Array.isArray(beforeValue) && Array.isArray(afterValue)) {
    if (beforeValue.length !== afterValue.length) return false;
    return beforeValue.every((entry, index) => entry === afterValue[index]);
  }
  if (typeof beforeValue === "number" && typeof afterValue === "number") {
    return Math.abs(beforeValue - afterValue) < 0.0001;
  }
  return JSON.stringify(beforeValue) === JSON.stringify(afterValue);
}

function formatDefault(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "On" : "Off";
  }
  return String(value);
}

function truncateInstructions(value: string): string {
  if (value.length <= 120) {
    return value || "—";
  }
  return `${value.slice(0, 117)}…`;
}

function truncateIdentifier(identifier: string): string {
  if (identifier.length <= 12) {
    return identifier;
  }
  return `${identifier.slice(0, 4)}…${identifier.slice(-4)}`;
}
