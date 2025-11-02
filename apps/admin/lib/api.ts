import type {
  AgentSetting,
  ComplianceOverview,
  FeatureFlagPayload,
  FeatureFlagState,
  TenantRecord,
  AnalyticsSnapshot,
} from './types';

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init?.headers),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload?.error === 'string' ? payload.error : response.statusText;
    throw new Error(message || 'Request failed');
  }

  return (await response.json()) as T;
}

export const fetchTenants = async (): Promise<TenantRecord[]> => {
  const { tenants } = await requestJson<{ tenants: TenantRecord[] }>('/api/admin/tenants');
  return tenants;
};

export const fetchAgentSettings = async (): Promise<AgentSetting[]> => {
  const { agents } = await requestJson<{ agents: AgentSetting[] }>('/api/admin/agents');
  return agents;
};

export const updateAgentSetting = async (id: string, payload: Partial<AgentSetting>) => {
  const { agent } = await requestJson<{ agent: AgentSetting }>(`/api/admin/agents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return agent;
};

export const fetchAnalyticsTimeseries = async (): Promise<AnalyticsSnapshot[]> => {
  const { analytics } = await requestJson<{ analytics: AnalyticsSnapshot[] }>('/api/admin/analytics');
  return analytics;
};

export const fetchComplianceOverview = async (): Promise<ComplianceOverview> => {
  const { compliance } = await requestJson<{ compliance: ComplianceOverview }>('/api/admin/compliance');
  return compliance;
};

export const fetchFeatureFlags = async (): Promise<FeatureFlagState[]> => {
  const { flags } = await requestJson<{ flags: FeatureFlagState[] }>('/api/admin/feature-flags');
  return flags;
};

export const createFeatureFlag = async (payload: FeatureFlagPayload) => {
  const { flag } = await requestJson<{ flag: FeatureFlagState }>('/api/admin/feature-flags', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return flag;
};

export const updateFeatureFlag = async (id: string, payload: Partial<FeatureFlagPayload>) => {
  const { flag } = await requestJson<{ flag: FeatureFlagState }>(`/api/admin/feature-flags/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return flag;
};

export const deleteFeatureFlag = async (id: string) => {
  await requestJson<{ id: string }>(`/api/admin/feature-flags/${id}`, { method: 'DELETE' });
  return id;
};
