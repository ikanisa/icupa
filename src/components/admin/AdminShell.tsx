import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { useAdminTenants } from "@/hooks/useAdminTenants";
import { OnboardingWizard } from "@/components/admin/OnboardingWizard";
import { AgentSettingsPanel } from "@/components/admin/AgentSettingsPanel";
import { AnalyticsOverview } from "@/components/admin/AnalyticsOverview";
import { CompliancePanel } from "@/components/admin/CompliancePanel";
import { PaymentRefundsPanel } from "@/components/admin/PaymentRefundsPanel";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "onboarding", label: "Onboarding" },
  { id: "agents", label: "AI Settings" },
  { id: "analytics", label: "Analytics" },
  { id: "compliance", label: "Compliance" },
];

export function AdminShell() {
  const { data: tenants, isLoading } = useAdminTenants();
  const [activeTab, setActiveTab] = useState<string>("onboarding");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const activeTenant = useMemo(() => {
    if (!tenants || tenants.length === 0) {
      return null;
    }
    if (selectedTenantId) {
      return tenants.find((tenant) => tenant.id === selectedTenantId) ?? tenants[0];
    }
    return tenants[0];
  }, [tenants, selectedTenantId]);

  const currency = activeTenant?.currency === "EUR" ? "EUR" : "RWF";
  const runbookBase = process.env.NEXT_PUBLIC_RUNBOOKS_BASE_URL ?? "https://github.com/icupa/icupa-pulse/tree/main/docs/runbooks";
  const complianceBase = "https://github.com/icupa/icupa-pulse/tree/main/docs";
  const grafanaUrl = process.env.NEXT_PUBLIC_GRAFANA_URL ?? "https://grafana.icupa.dev";
  const jaegerUrl = process.env.NEXT_PUBLIC_JAEGER_URL ?? "https://jaeger.icupa.dev";
  const alertPlaybookUrl = process.env.NEXT_PUBLIC_ALERTS_RUNBOOK_URL ?? `${runbookBase}/alerts-escalation.md`;

  const runbookLinks = [
    {
      label: 'Payments Timeout',
      description: 'Manual recovery steps for PSP outages and backlog drains.',
      href: `${runbookBase}/payments-timeout.md`,
    },
    {
      label: 'Fiscalization',
      description: 'Rwanda EBM and Malta fiscal receipt runbooks.',
      href: `${runbookBase}/fiscalization.md`,
    },
    {
      label: 'Voice Waiter Readiness',
      description: 'Preflight checklist before enabling realtime voice waiter.',
      href: `${runbookBase}/voice-waiter-readiness.md`,
    },
    {
      label: 'Alerts & Escalation',
      description: 'On-call contacts and pager rotations.',
      href: alertPlaybookUrl,
    },
    {
      label: 'Chaos Drill Playbook',
      description: 'Quarterly chaos scenarios and recovery steps.',
      href: `${runbookBase}/chaos-drill.md`,
    },
    {
      label: 'DPIA Schedule',
      description: 'Quarterly privacy assessment calendar and owners.',
      href: `${complianceBase}/compliance/dpia-schedule.md`,
    },
  ];

  const observabilityLinks = [
    { label: 'Grafana Dashboards', href: grafanaUrl },
    { label: 'Jaeger Traces', href: jaegerUrl },
  ];

  return (
    <div className="min-h-screen bg-[length:400%_400%] p-6 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-white/70">Admin console</p>
            <h1 className="mt-1 text-3xl font-semibold">ICUPA Operations Hub</h1>
            <p className="text-sm text-white/70">Govern onboarding, AI levers, analytics, and compliance in one workspace.</p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Card className="glass-card w-full max-w-xs border border-white/10 bg-white/10 p-4">
              <p className="text-xs uppercase text-white/60">Tenant</p>
              {isLoading ? (
                <Skeleton className="mt-3 h-10 w-full bg-white/10" />
              ) : (
                <Select
                  value={activeTenant?.id}
                  onValueChange={(value) => setSelectedTenantId(value)}
                >
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
            <Button asChild variant="outline" className="border-white/40 text-white hover:bg-white/20">
              <Link to="/admin/tools/qr">QR tools</Link>
            </Button>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="glass-card grid h-12 grid-cols-4 gap-2 border border-white/10 bg-white/10 p-1 text-xs uppercase tracking-wide text-white/80">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  "rounded-xl data-[state=active]:bg-white data-[state=active]:text-primary",
                  "transition"
                )}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="onboarding" className="mt-0">
            <OnboardingWizard
              onTenantCreated={(tenantId) => {
                setSelectedTenantId(tenantId);
                setActiveTab("agents");
              }}
            />
          </TabsContent>

          <TabsContent value="agents" className="mt-0">
            <AgentSettingsPanel tenantId={activeTenant?.id ?? null} />
          </TabsContent>

          <TabsContent value="analytics" className="mt-0">
            <AnalyticsOverview tenantId={activeTenant?.id ?? null} currency={currency} />
          </TabsContent>

          <TabsContent value="compliance" className="mt-0 space-y-6">
            <CompliancePanel tenantId={activeTenant?.id ?? null} />
            <PaymentRefundsPanel />
          </TabsContent>
        </Tabs>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="glass-card border border-white/10 bg-white/10 p-6 text-white">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Runbooks</p>
            <ul className="mt-4 space-y-3 text-sm text-white/80">
              {runbookLinks.map((entry) => (
                <li key={entry.label} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <a href={entry.href} target="_blank" rel="noreferrer" className="font-semibold text-white hover:underline">
                    {entry.label}
                  </a>
                  <p className="mt-1 text-xs text-white/60">{entry.description}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="glass-card border border-white/10 bg-white/10 p-6 text-white">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Observability</p>
            <ul className="mt-4 space-y-3 text-sm text-white/80">
              {observabilityLinks.map((entry) => (
                <li key={entry.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div>
                    <span className="font-semibold text-white">{entry.label}</span>
                    <p className="text-xs text-white/60">Live SLO dashboards and traces</p>
                  </div>
                  <a
                    href={entry.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/30 px-3 py-1 text-xs uppercase tracking-wide text-white hover:bg-white/20"
                  >
                    Open
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
