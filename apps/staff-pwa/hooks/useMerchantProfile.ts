import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client";

export type MerchantOnboardingStep =
  | "start"
  | "verify"
  | "business"
  | "momo"
  | "gps"
  | "menu"
  | "done";

export interface MerchantProfile {
  userId: string;
  tenantId: string;
  role: string;
  whatsappNumberE164: string | null;
  whatsappVerifiedAt: string | null;
  onboardingStep: MerchantOnboardingStep;
  momoCode: string | null;
  locationGps: { lat: number; lng: number; addr?: string } | null;
  createdAt: string;
  updatedAt: string;
}

async function fetchMerchantProfile(): Promise<MerchantProfile | null> {
  const { data, error } = await supabase
    .from("merchant_profiles")
    .select(
      "user_id, tenant_id, role, whatsapp_number_e164, whatsapp_verified_at, onboarding_step, momo_code, location_gps, created_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    userId: data.user_id,
    tenantId: data.tenant_id,
    role: data.role ?? "owner",
    whatsappNumberE164: data.whatsapp_number_e164 ?? null,
    whatsappVerifiedAt: data.whatsapp_verified_at ?? null,
    onboardingStep: (data.onboarding_step ?? "start") as MerchantOnboardingStep,
    momoCode: data.momo_code ?? null,
    locationGps: (data.location_gps as MerchantProfile["locationGps"]) ?? null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export function useMerchantProfile() {
  return useQuery({
    queryKey: ["merchant", "profile"],
    queryFn: fetchMerchantProfile,
    staleTime: 60_000,
  });
}

interface OnboardingUpdatePayload {
  momo_code?: string;
  gps?: { lat?: number; lng?: number; addr?: string } | null;
  step?: MerchantOnboardingStep;
}

export function useMerchantOnboardingUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: OnboardingUpdatePayload) => {
      const { data, error } = await supabase.functions.invoke<{
        ok: boolean;
        profile: MerchantProfile;
      }>("merchant/onboarding_update", {
        body: payload,
      });

      if (error) {
        throw error;
      }

      return data?.profile ?? null;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(["merchant", "profile"], profile);
      queryClient.invalidateQueries({ queryKey: ["merchant", "locations"] });
    },
  });
}
