import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@icupa/db';
import { requireAdmin } from '../../../../lib/auth/session';
import type { TenantRecord, TenantStatus } from '../../../../lib/types';

const REGION_LABEL: Record<string, string> = {
  RW: 'Rwanda',
  EU: 'Malta',
};

const AUTONOMY_LEVEL: Record<string, number> = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
};

function resolveStatus(options: {
  hasKpi: boolean;
  blocked: boolean;
  syncPending: boolean;
}): TenantStatus {
  if (options.blocked) {
    return 'blocked';
  }
  if (!options.hasKpi) {
    return 'onboarding';
  }
  if (options.syncPending) {
    return 'pilot';
  }
  return 'active';
}

export async function GET() {
  await requireAdmin();
  const supabase = createServerSupabaseClient();

  const [{ data: tenants, error: tenantsError }, { data: locations }, { data: compliance }, { data: configs }, { data: kpis }] =
    await Promise.all([
      supabase.from('tenants').select('id, name, region, created_at, settings'),
      supabase.from('locations').select('id, tenant_id'),
      supabase.from('compliance_tasks').select('tenant_id, status, title, due_at').order('due_at', { ascending: true }),
      supabase
        .from('agent_runtime_configs')
        .select('tenant_id, autonomy_level, sync_pending, updated_at')
        .neq('tenant_id', null),
      supabase.from('tenant_kpi_snapshots').select('tenant_id').limit(1000),
    ]);

  if (tenantsError) {
    return NextResponse.json({ error: tenantsError.message }, { status: 500 });
  }

  const locationCounts = new Map<string, number>();
  (locations ?? []).forEach((row: any) => {
    const tenantId = row.tenant_id as string;
    locationCounts.set(tenantId, (locationCounts.get(tenantId) ?? 0) + 1);
  });

  const complianceMap = new Map<string, any[]>();
  (compliance ?? []).forEach((task: any) => {
    const key = task.tenant_id ?? 'global';
    if (!complianceMap.has(key)) {
      complianceMap.set(key, []);
    }
    complianceMap.get(key)!.push(task);
  });

  const configMap = new Map<string, any[]>();
  (configs ?? []).forEach((config: any) => {
    const key = config.tenant_id as string;
    if (!configMap.has(key)) {
      configMap.set(key, []);
    }
    configMap.get(key)!.push(config);
  });

  const kpiTenants = new Set<string>((kpis ?? []).map((row: any) => row.tenant_id as string));

  const records: TenantRecord[] = (tenants ?? []).map((tenant: any) => {
    const tenantId = tenant.id as string;
    const tenantCompliance = complianceMap.get(tenantId) ?? [];
    const blocked = tenantCompliance.some((task) => task.status === 'blocked');
    const firstTask = tenantCompliance[0];
    const tenantConfigs = configMap.get(tenantId) ?? [];
    const syncPending = tenantConfigs.some((config) => config.sync_pending === true);
    const autonomyLevel = tenantConfigs.reduce((acc, config) => {
      const level = AUTONOMY_LEVEL[config.autonomy_level as string] ?? 0;
      return Math.max(acc, level);
    }, 0);

    const status = resolveStatus({
      hasKpi: kpiTenants.has(tenantId),
      blocked,
      syncPending,
    });

    const regionCode = tenant.region as string;
    const locationCount = locationCounts.get(tenantId) ?? 0;
    const createdAt = tenant.created_at ? new Date(tenant.created_at as string) : new Date();
    const goLiveTarget = new Date(createdAt.getTime() + 1000 * 60 * 60 * 24 * 21);

    return {
      id: tenantId,
      name: tenant.name as string,
      region: REGION_LABEL[regionCode] ?? regionCode,
      locations: locationCount,
      status,
      onboardingStep: firstTask ? `${firstTask.title} (${firstTask.status})` : 'Initial data sync',
      goLiveTarget: goLiveTarget.toISOString(),
      accountManager: 'Unassigned',
      aiAutonomy: autonomyLevel,
      notes: syncPending
        ? 'Recent configuration changes pending propagation to agents.'
        : 'Agents synchronized and live.',
    } satisfies TenantRecord;
  });

  return NextResponse.json({ tenants: records });
}
