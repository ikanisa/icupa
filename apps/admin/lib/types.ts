export type TenantStatus = 'onboarding' | 'active' | 'blocked' | 'pilot';

export interface TenantRecord {
  id: string;
  name: string;
  region: string;
  locations: number;
  status: TenantStatus;
  onboardingStep: string;
  goLiveTarget: string;
  accountManager: string;
  aiAutonomy: number;
  notes: string;
}

export type AgentAutonomyLevel = 0 | 1 | 2 | 3;

export interface AgentToolSetting {
  name: string;
  description: string;
  enabled: boolean;
}

export interface AgentSetting {
  id: string;
  tenantId: string | null;
  agentType: string;
  title: string;
  description: string;
  autonomy: AgentAutonomyLevel;
  sessionBudgetUsd: number;
  dailyBudgetUsd: number;
  instructions: string;
  tools: AgentToolSetting[];
  experimentFlag: string | null;
  lastUpdated: string;
  syncPending: boolean;
}

export interface AnalyticsSnapshot {
  windowLabel: string;
  gmv: number;
  aov: number;
  attachRate: number;
  aiAcceptance: number;
  hallucinationRate: number;
  prepSla: number;
}

export interface ComplianceMetric {
  id: string;
  title: string;
  value: string;
  delta: string;
  trend: 'up' | 'down' | 'stable';
  detail: string;
}

export interface ComplianceIncident {
  id: string;
  tenantId: string | null;
  title: string;
  status: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  openedAt: string;
  dueAt: string | null;
}

export interface ComplianceOverview {
  metrics: ComplianceMetric[];
  incidents: ComplianceIncident[];
}

export interface FeatureFlagState {
  id: string;
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  audience: string[];
  tenantId: string | null;
  experimentFlag: string | null;
  syncPending: boolean;
  updatedAt: string;
  autonomyLevel: AgentAutonomyLevel;
  sessionBudgetUsd: number;
  dailyBudgetUsd: number;
  instructions: string;
}

export interface FeatureFlagPayload {
  key: string;
  label: string;
  description: string;
  audience: string[];
  tenantId: string | null;
  experimentFlag?: string | null;
  enabled: boolean;
  autonomyLevel: AgentAutonomyLevel;
  sessionBudgetUsd: number;
  dailyBudgetUsd: number;
  instructions: string;
}
