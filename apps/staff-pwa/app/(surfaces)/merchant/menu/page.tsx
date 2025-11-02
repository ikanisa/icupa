"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@icupa/ui/button";
import { Card } from "@icupa/ui/card";
import { Badge } from "@icupa/ui/badge";
import { Separator } from "@icupa/ui/separator";
import { Skeleton } from "@icupa/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@icupa/ui/select";
import { useMenuIngestions } from "@/hooks/useMenuIngestionPipeline";
import { useMerchantLocations } from "@/hooks/useMerchantLocations";
import { useMerchantProfile } from "@/hooks/useMerchantProfile";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/lib/supabase-client";
import { Alert, AlertDescription } from "@icupa/ui/alert";

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  uploaded: { label: "Uploaded", variant: "outline" },
  processing: { label: "Processing", variant: "default" },
  awaiting_review: { label: "Awaiting review", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
  published: { label: "Published", variant: "default" },
};

export default function MerchantMenuIngestionsPage() {
  const router = useRouter();
  const { data: locations = [], isLoading: isLoadingLocations } = useMerchantLocations();
  const { data: profile } = useMerchantProfile();
  const [selectedLocation, setSelectedLocation] = useState<string | undefined>(undefined);
  const { data: ingestions, isLoading } = useMenuIngestions(selectedLocation);
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
    return () => {
      mounted = false;
    };
  }, [router]);

  const activeLocation = useMemo(() => locations.find((loc) => loc.id === selectedLocation) ?? null, [
    locations,
    selectedLocation,
  ]);

  const handleLocationChange = (value: string) => {
    setSelectedLocation(value === "all" ? undefined : value);
  };

  if (checkingSession) {
    return (
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10 text-white">
        Checking session…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Menu ingestion pipeline</h1>
          <p className="text-sm text-white/70">
            Upload raw menus, review AI-extracted drafts, and publish directly to the live catalogue.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => router.push("/merchant/menu/upload")}>Upload new menu</Button>
        </div>
      </header>

      {profile?.onboardingStep && profile.onboardingStep !== "done" && (
        <Alert className="border-white/10 bg-amber-500/10 text-white">
          <AlertDescription>
            Complete onboarding in <button type="button" className="underline" onClick={() => router.push("/merchant/settings")}>settings</button> to unlock full menu publishing controls. Current step: {profile.onboardingStep}.
          </AlertDescription>
        </Alert>
      )}

      <Card className="glass-card border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Drafts & history</h2>
            <p className="text-xs text-white/60">Track ingestion status, confidence, and publish readiness.</p>
          </div>
          <Select onValueChange={handleLocationChange} defaultValue="all">
            <SelectTrigger className="w-[220px] border-white/20 bg-black/30 text-white">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-black/80 text-white">
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Separator className="my-5 bg-white/10" />

        {isLoading || isLoadingLocations ? (
          <div className="grid gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        ) : ingestions && ingestions.length > 0 ? (
          <div className="grid gap-4">
            {ingestions.map((ingestion) => {
              const status = STATUS_BADGE[ingestion.status] ?? {
                label: ingestion.status,
                variant: "outline" as const,
              };

              const locationName = activeLocation
                ? activeLocation.name
                : locations.find((loc) => loc.id === (ingestion.metadata as any)?.location_id)?.name ?? "All locations";

              const confidenceBuckets = (ingestion.metadata?.confidence_buckets ?? {}) as Record<string, number>;

              return (
                <button
                  type="button"
                  key={ingestion.id}
                  onClick={() => router.push(`/merchant/menu/review/${ingestion.id}`)}
                  className="w-full rounded-3xl border border-white/10 bg-black/30 p-5 text-left transition hover:border-primary/60"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.25em] text-white/60">{locationName}</p>
                      <h3 className="text-xl font-semibold text-white">
                        {ingestion.originalFilename ?? "Menu upload"}
                      </h3>
                    </div>
                    <Badge variant={status.variant} className="border-white/10 bg-white/10 text-xs text-white">
                      {status.label}
                    </Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-white/70 sm:grid-cols-4">
                    <div>
                      <p className="uppercase tracking-[0.2em] text-white/50">Items</p>
                      <p className="mt-1 text-base text-white">{ingestion.itemsCount}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.2em] text-white/50">Pages</p>
                      <p className="mt-1 text-base text-white">{ingestion.pagesProcessed}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.2em] text-white/50">Last update</p>
                      <p className="mt-1 text-base text-white">
                        {formatDistanceToNow(new Date(ingestion.updatedAt), { addSuffix: true })}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.2em] text-white/50">Confidence ≥ 0.75</p>
                      <p className="mt-1 text-base text-white">
                        {confidenceBuckets?.ge_75 ?? 0}/{ingestion.itemsCount}
                      </p>
                    </div>
                  </div>
                  {ingestion.errors && ingestion.errors.length > 0 && (
                    <div className="mt-3 rounded-2xl border border-destructive/40 bg-destructive/20 p-3 text-xs text-destructive-foreground">
                      {(ingestion.errors as any[]).map((error, index) => (
                        <p key={index}>{typeof error === "object" ? JSON.stringify(error) : String(error)}</p>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <p className="text-base text-white/70">No drafts yet. Upload a menu to get started.</p>
            <Button onClick={() => router.push("/merchant/menu/upload")}>Start new ingestion</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
