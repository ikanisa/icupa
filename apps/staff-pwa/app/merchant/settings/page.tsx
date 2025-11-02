"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { MerchantOnboardingPanel } from "@/components/merchant/MerchantOnboardingPanel";

const gradientBackdrop = "bg-[radial-gradient(circle_at_top,_rgba(80,133,255,0.12),_rgba(12,12,30,0.92))]";

export default function MerchantSettingsPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      if (!data.session) {
        router.replace("/merchant/login");
      } else {
        setCheckingSession(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [router]);

  if (checkingSession) {
    return (
      <div className={`min-h-screen ${gradientBackdrop} flex items-center justify-center text-white`}>Checking session…</div>
    );
  }

  return (
    <div className={`min-h-screen ${gradientBackdrop} px-6 py-14 text-white`}>
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Merchant Onboarding</h1>
          <p className="text-sm text-white/70">
            Complete these setup steps to unlock ordering, settlement, and compliance automation.
          </p>
        </div>
        <MerchantOnboardingPanel />
      </div>
    </div>
  );
}
