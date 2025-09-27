'use client';

import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@icupa/ui/tabs";
import { Card } from "@icupa/ui/card";
import { Button } from "@icupa/ui/button";
import { Skeleton } from "@icupa/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@icupa/ui/select";
import Link from "next/link";
import { useAdminTenants } from "@/hooks/useAdminTenants";
import { OnboardingWizard } from "@/components/admin/OnboardingWizard";
import { AgentSettingsPanel } from "@/components/admin/AgentSettingsPanel";
import { AnalyticsOverview } from "@/components/admin/AnalyticsOverview";
import { CompliancePanel } from "@/components/admin/CompliancePanel";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase-client";
import { Alert, AlertDescription } from "@icupa/ui/alert";
import { useRouter } from "next/navigation";

const TABS = [
  { id: "onboarding", label: "Onboarding" },
  { id: "agents", label: "AI Settings" },
  { id: "analytics", label: "Analytics" },
  { id: "compliance", label: "Compliance" },
];

export function AdminShell() {
  const router = useRouter();
  const { data: tenants, isLoading } = useAdminTenants();
  const [checkingSession, setCheckingSession] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("onboarding");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (!mounted) return;
      if (error || !data?.user) {
        router.replace("/admin/login");
        return;
      }
      const { data: roleRow, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleError || !roleRow) {
        router.replace("/admin/login");
        return;
      }
      setAuthorized(true);
      setCheckingSession(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/admin/login");
      }
    });

    return () => {
      mounted = false;
      subscription?.subscription.unsubscribe();
    };
  }, [router]);

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

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[length:400%_400%] p-6 text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-center">Checking admin session…</div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[length:400%_400%] p-6 text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-center">
          <Alert className="border-white/10 bg-white/10 text-white">
            <AlertDescription>Redirecting to admin login…</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

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
              <Link href="/admin/tools/qr">QR tools</Link>
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

          <TabsContent value="compliance" className="mt-0">
            <CompliancePanel tenantId={activeTenant?.id ?? null} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
