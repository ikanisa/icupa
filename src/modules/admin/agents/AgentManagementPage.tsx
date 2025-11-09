import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@icupa/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@icupa/ui/select";
import { Skeleton } from "@icupa/ui/skeleton";
import { AgentPerformanceWidget, WebsearchInsightsWidget } from "@/components/admin/widgets";
import { AgentActionQueue } from "@/components/admin/AgentActionQueue";
import { useAdminTenants } from "@/hooks/useAdminTenants";

export function AgentManagementPage() {
  const { t } = useTranslation();
  const { data: tenants, isLoading } = useAdminTenants();
  const [tenantId, setTenantId] = useState<string | null>(null);

  const activeTenant = useMemo(() => {
    if (!tenants || tenants.length === 0) {
      return null;
    }
    if (tenantId) {
      return tenants.find((tenant) => tenant.id === tenantId) ?? tenants[0];
    }
    return tenants[0];
  }, [tenantId, tenants]);

  return (
    <div className="min-h-screen bg-[length:400%_400%] p-6 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-white/70">{t("navigation.adminAgents")}</p>
            <h1 className="mt-1 text-3xl font-semibold">AI Agent Operations</h1>
            <p className="text-sm text-white/70">
              Track live runs, queued actions, and search telemetry across every tenant deployment.
            </p>
          </div>
          <Card className="glass-card w-full max-w-xs border border-white/10 bg-white/10 p-4">
            <p className="text-xs uppercase text-white/60">Tenant</p>
            {isLoading ? (
              <Skeleton className="mt-3 h-10 w-full bg-white/10" />
            ) : (
              <Select value={activeTenant?.id} onValueChange={(value) => setTenantId(value)}>
                <SelectTrigger className="mt-3 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-primary">
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants?.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id} className="text-black">
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Card>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <AgentPerformanceWidget tenant={activeTenant ?? null} />
          <WebsearchInsightsWidget tenant={activeTenant ?? null} />
        </div>

        <Card className="glass-card border border-white/10 bg-white/10 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Action queue</p>
              <p className="text-sm text-white/70">
                Review pending tool calls and agent tasks awaiting staff approval.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <AgentActionQueue tenantId={activeTenant?.id ?? null} />
          </div>
        </Card>
      </div>
    </div>
  );
}

export default AgentManagementPage;
