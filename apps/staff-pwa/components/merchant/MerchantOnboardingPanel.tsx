"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@icupa/ui/button";
import { Card } from "@icupa/ui/card";
import { Input } from "@icupa/ui/input";
import { Separator } from "@icupa/ui/separator";
import { Badge } from "@icupa/ui/badge";
import { Alert, AlertDescription } from "@icupa/ui/alert";
import { toast } from "@icupa/ui/use-toast";
import { useMerchantOnboardingUpdate, useMerchantProfile, type MerchantOnboardingStep } from "@/hooks/useMerchantProfile";

const STEPS: { id: MerchantOnboardingStep; title: string; description: string }[] = [
  { id: "verify", title: "Verify WhatsApp", description: "WhatsApp login verified for this merchant." },
  { id: "business", title: "Business Profile", description: "Confirm your legal details and operating info." },
  { id: "momo", title: "Mobile Money", description: "Share the till / pay code we should use for MoMo settlement." },
  { id: "gps", title: "Venue GPS", description: "Capture your primary venue location for dispatch & regulatory proofs." },
  { id: "menu", title: "Menu Upload", description: "Upload or refresh your menu to keep diners in sync." },
  { id: "done", title: "Ready to Serve", description: "Onboarding complete. Keep profiles fresh as things change." },
];

const MAPS_BASE = process.env.NEXT_PUBLIC_MAPS_DEEPLINK_BASE ?? "https://maps.google.com/?q=";

function statusFor(step: MerchantOnboardingStep, current: MerchantOnboardingStep) {
  const index = STEPS.findIndex((item) => item.id === step);
  const currentIndex = STEPS.findIndex((item) => item.id === current);
  if (index < currentIndex) return "complete" as const;
  if (index === currentIndex) return "active" as const;
  return "upcoming" as const;
}

export function MerchantOnboardingPanel() {
  const { data: profile, isLoading, error } = useMerchantProfile();
  const { mutateAsync, isPending } = useMerchantOnboardingUpdate();
  const [momoCode, setMomoCode] = useState("");
  const [gpsPending, setGpsPending] = useState(false);

  useEffect(() => {
    if (profile?.momoCode) {
      setMomoCode(profile.momoCode);
    }
  }, [profile?.momoCode]);

  const onboardingStep = useMemo<MerchantOnboardingStep>(() => profile?.onboardingStep ?? "start", [profile]);

  const currentStep = onboardingStep === "start" ? "verify" : onboardingStep;
  const currentIndex = STEPS.findIndex((step) => step.id === currentStep);

  const handleAdvance = async (step: MerchantOnboardingStep, payload?: Record<string, unknown>) => {
    try {
      await mutateAsync({ ...(payload ?? {}), step });
      toast({ title: "Progress saved", description: "Onboarding status updated." });
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : "Unable to update onboarding.";
      toast({ title: "Update failed", description: message, variant: "destructive" });
    }
  };

  const handleSaveMomo = async () => {
    if (!momoCode.trim()) {
      toast({ title: "Missing code", description: "Enter the MoMo code provided by your PSP.", variant: "destructive" });
      return;
    }
    await handleAdvance("gps", { momo_code: momoCode.trim() });
  };

  const captureGps = async () => {
    if (!navigator.geolocation) {
      toast({ title: "Unsupported", description: "Geolocation is not available in this browser.", variant: "destructive" });
      return;
    }
    setGpsPending(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setGpsPending(false);
        await handleAdvance("menu", {
          gps: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
        });
      },
      (geoError) => {
        setGpsPending(false);
        toast({
          title: "Location blocked",
          description: geoError.message ?? "Allow location access to continue.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  if (error) {
    return (
      <Alert variant="destructive" className="border-white/10 bg-rose-500/10 text-white">
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="glass-card border border-white/10 bg-black/30 p-6 text-white shadow-lg">
      <div className="flex flex-col gap-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Onboarding checklist</h2>
          <p className="text-sm text-white/70">
            Complete each step to unlock ordering, settlement, and compliance workflows.
          </p>
        </div>

        <div className="space-y-4">
          {STEPS.map((step, index) => {
            if (step.id === "start") {
              return null;
            }
            const status = statusFor(step.id, currentStep);
            const isCurrent = index === currentIndex;
            const isComplete = status === "complete";
            const badgeVariant = isComplete ? "default" : isCurrent ? "secondary" : "outline";
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className="rounded-3xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={badgeVariant} className="uppercase tracking-[0.3em] text-xs">
                        {status === "complete" ? "Done" : status === "active" ? "Now" : "Next"}
                      </Badge>
                      <h3 className="text-lg font-semibold">{step.title}</h3>
                    </div>
                    <p className="mt-1 text-sm text-white/70">{step.description}</p>
                  </div>
                </div>

                {step.id === "business" && status === "active" && (
                  <div className="mt-4 space-y-3 text-sm text-white/70">
                    <p>Review your registration with the ICUPA team. When finished, mark this step complete.</p>
                    <Button
                      onClick={() => handleAdvance("momo")}
                      className="rounded-full bg-gradient-to-r from-primary to-violet-500 text-black hover:brightness-110"
                      disabled={isPending}
                    >
                      Mark business profile reviewed
                    </Button>
                  </div>
                )}

                {step.id === "momo" && status === "active" && (
                  <div className="mt-4 space-y-3">
                    <label htmlFor="momo-code" className="text-xs uppercase tracking-[0.3em] text-white/60">
                      MoMo pay code
                    </label>
                    <Input
                      id="momo-code"
                      placeholder="MTN-1234"
                      value={momoCode}
                      onChange={(event) => setMomoCode(event.target.value)}
                      className="border-white/10 bg-white/10 text-white placeholder:text-white/40"
                      maxLength={32}
                    />
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={handleSaveMomo}
                        className="rounded-full bg-gradient-to-r from-primary to-violet-500 text-black hover:brightness-110"
                        disabled={isPending}
                      >
                        Save MoMo code
                      </Button>
                      {profile?.momoCode && (
                        <span className="text-xs text-white/60">Current: {profile.momoCode}</span>
                      )}
                    </div>
                  </div>
                )}

                {step.id === "gps" && status === "active" && (
                  <div className="mt-4 space-y-3 text-sm text-white/70">
                    <p>Capture your current location from a staff device on-site.</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        onClick={captureGps}
                        className="rounded-full bg-gradient-to-r from-primary to-violet-500 text-black hover:brightness-110"
                        disabled={gpsPending || isPending}
                      >
                        {gpsPending ? "Capturing..." : "Capture GPS"}
                      </Button>
                      {profile?.locationGps && (
                        <a
                          href={`${MAPS_BASE}${profile.locationGps.lat},${profile.locationGps.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-white/80 underline"
                        >
                          Open in maps
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {step.id === "menu" && status === "active" && (
                  <div className="mt-4 space-y-3 text-sm text-white/70">
                    <p>Upload or refresh your menu to finish onboarding.</p>
                    <div className="flex gap-3">
                      <Button
                        asChild
                        className="rounded-full bg-gradient-to-r from-primary to-violet-500 text-black hover:brightness-110"
                      >
                        <a href="/merchant/menu/upload">Upload menu</a>
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-full border-white/30 text-white hover:bg-white/10"
                        onClick={() => handleAdvance("done")}
                        disabled={isPending}
                      >
                        Mark onboarding complete
                      </Button>
                    </div>
                  </div>
                )}

                {step.id === "done" && status === "complete" && (
                  <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                    You're ready to accept live orders. Update these settings anytime to keep your venue compliant.
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <Separator className="bg-white/10" />

        <div className="space-y-3 text-sm text-white/70">
         {isLoading ? (
            <p>Loading profile…</p>
          ) : (
            <>
              <p>
                Verified WhatsApp: {profile?.whatsappNumberE164 ?? "—"} {profile?.whatsappVerifiedAt ? "(verified)" : ""}
              </p>
              <p>MoMo code on file: {profile?.momoCode ?? "—"}</p>
              <p>
                GPS pin:
                {profile?.locationGps
                  ? ` ${profile.locationGps.lat.toFixed(5)}, ${profile.locationGps.lng.toFixed(5)}`
                  : " —"}
              </p>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
