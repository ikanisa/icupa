import { loadClientEnv } from '@icupa/config';
import { FeatureFlag } from '@icupa/config/feature-flags';
import {
  agentSettings,
  analyticsTimeseries,
  complianceIncidents,
  complianceMetrics,
  rolloutFlags,
  tenants,
  type AgentSetting,
  type FeatureFlagState,
  type TenantRecord,
} from '../data/sample';

const getFunctionUrl = (path: string) => {
  const env = loadClientEnv();
  return {
    url: `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${path}`,
    key: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
};

const supabaseFetch = async <T>(path: string, method: 'POST' | 'GET', body?: Record<string, unknown>): Promise<T> => {
  const { url, key } = getFunctionUrl(path);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Supabase function ${path} failed: ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    console.warn('[admin] Falling back to mocked response for', path, error);
    return {} as T;
  }
};

export const requestAdminMagicLink = async (email: string) =>
  supabaseFetch<{ status: 'sent' }>('auth/admin_email_magiclink', 'POST', { email });

export const fetchTenants = async (): Promise<TenantRecord[]> => tenants;

export const fetchAgentSettings = async (): Promise<AgentSetting[]> => agentSettings;

export const fetchAnalyticsTimeseries = async () => analyticsTimeseries;

export const fetchComplianceOverview = async () => ({ metrics: complianceMetrics, incidents: complianceIncidents });

export const fetchFeatureFlags = async (): Promise<FeatureFlagState[]> => rolloutFlags;

export const syncFeatureFlag = async (flag: FeatureFlag, enabled: boolean) =>
  supabaseFetch<{ key: string; enabled: boolean }>('admin/feature_flags/upsert', 'POST', {
    flag,
    enabled,
  });

export const patchAgentSettings = async (payload: Partial<AgentSetting> & { id: string }) =>
  supabaseFetch<{ id: string }>('admin/agents/update_settings', 'POST', payload);
