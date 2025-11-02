'use client';

import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@icupa/ui/tabs";
import { Card } from "@icupa/ui/card";
import { Skeleton } from "@icupa/ui/skeleton";
import { useMerchantLocations } from "@/hooks/useMerchantLocations";
import { KDSBoard } from "@/components/merchant/KDSBoard";
import { FloorPlanner } from "@/components/merchant/FloorPlanner";
import { MenuManagerPanel } from "@/components/merchant/MenuManagerPanel";
import { InventoryManagerPanel } from "@/components/merchant/InventoryManagerPanel";
import { PromoBuilderPanel } from "@/components/merchant/PromoBuilderPanel";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase-client";
import { Alert, AlertDescription } from "@icupa/ui/alert";
import { Button } from "@icupa/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMerchantProfile } from "@/hooks/useMerchantProfile";

const TABS = [
  { id: "kds", label: "KDS" },
  { id: "floor", label: "Floor" },
  { id: "menu", label: "Menu" },
  { id: "inventory", label: "Inventory" },
  { id: "promos", label: "Promos" },
];

export function MerchantShell() {
  const router = useRouter();
  const { data: locations, isLoading } = useMerchantLocations();
  const { data: profile } = useMerchantProfile();
  const [activeTab, setActiveTab] = useState<string>("kds");
  const [locationId, setLocationId] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        router.replace("/merchant/login");
      } else {
        setCheckingSession(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/merchant/login");
      }
    });

    return () => {
      mounted = false;
      subscription?.subscription.unsubscribe();
    };
  }, [router]);

  const activeLocation = useMemo(() => {
    if (!locations || locations.length === 0) {
      return null;
    }
    if (locationId) {
      return locations.find((location) => location.id === locationId) ?? locations[0];
    }
    return locations[0];
  }, [locationId, locations]);

  const onboardingIncomplete = profile && profile.onboardingStep !== "done";

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[length:400%_400%] p-6 text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-center">Checking session…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[length:400%_400%] p-6 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-white/70">Merchant portal</p>
            <h1 className="mt-1 text-3xl font-semibold">{activeLocation?.name ?? "Loading venues"}</h1>
            <p className="text-sm text-white/70">
              Manage pacing, service, and merchandising across your floor in real time.
            </p>
          </div>
          <Card className="glass-card w-full max-w-xs p-4">
            <p className="text-xs uppercase text-white/60">Location</p>
            {isLoading ? (
              <Skeleton className="mt-3 h-10 w-full" />
            ) : (
              <select
                value={activeLocation?.id}
                onChange={(event) => setLocationId(event.target.value)}
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {locations?.map((location) => (
                  <option key={location.id} value={location.id} className="text-black">
                    {location.name}
                  </option>
                ))}
              </select>
            )}
          </Card>
        </header>

        {onboardingIncomplete && (
          <Alert className="border-white/10 bg-amber-500/10 text-white">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>
                Finish onboarding to unlock all merchant tools. Current step: {profile?.onboardingStep ?? "verify"}.
              </span>
              <Button asChild variant="outline" className="rounded-full border-white/40 text-white hover:bg-white/10">
                <Link href="/merchant/settings">Continue setup</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="glass-card grid h-12 grid-cols-5 gap-2 border border-white/10 bg-white/10 p-1 text-xs uppercase tracking-wide text-white/80">
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

          <TabsContent value="kds" className="mt-0">
            <KDSBoard location={activeLocation ?? null} />
          </TabsContent>
          <TabsContent value="floor" className="mt-0">
            <FloorPlanner location={activeLocation ?? null} />
          </TabsContent>
          <TabsContent value="menu" className="mt-0">
            <MenuManagerPanel location={activeLocation ?? null} />
          </TabsContent>
          <TabsContent value="inventory" className="mt-0">
            <InventoryManagerPanel location={activeLocation ?? null} />
          </TabsContent>
          <TabsContent value="promos" className="mt-0">
            <PromoBuilderPanel location={activeLocation ?? null} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
