import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MerchantLocation } from "@/hooks/useMerchantLocations";
import { withSupabaseCaching } from "@/lib/query-client";

export type PromoStatus = "draft" | "pending_review" | "approved" | "active" | "paused" | "archived";

export interface PromoCampaign {
  id: string;
  tenantId: string;
  locationId: string | null;
  name: string;
  description?: string | null;
  epsilon: number;
  budgetCapCents: number;
  spentCents: number;
  frequencyCap: number;
  fairnessConstraints: Record<string, unknown>;
  status: PromoStatus;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

interface RawPromoRow {
  id: string;
  tenant_id: string;
  location_id: string | null;
  name: string;
  description: string | null;
  epsilon: number | null;
  budget_cap_cents: number | null;
  spent_cents: number | null;
  frequency_cap: number | null;
  fairness_constraints: Record<string, unknown> | null;
  status: PromoStatus;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  reviewed_at: string | null;
}

async function fetchPromos(location?: MerchantLocation | null): Promise<PromoCampaign[]> {
  let query = supabase
    .from("promo_campaigns")
    .select(
      "id, tenant_id, location_id, name, description, epsilon, budget_cap_cents, spent_cents, frequency_cap, fairness_constraints, status, starts_at, ends_at, created_at, reviewed_at"
    )
    .order("created_at", { ascending: false });

  if (location) {
    query = query.eq("location_id", location.id);
  }

  const { data, error } = await query.returns<RawPromoRow[]>();
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    locationId: row.location_id,
    name: row.name,
    description: row.description,
    epsilon: row.epsilon ?? 0,
    budgetCapCents: row.budget_cap_cents ?? 0,
    spentCents: row.spent_cents ?? 0,
    frequencyCap: row.frequency_cap ?? 0,
    fairnessConstraints: row.fairness_constraints ?? {},
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  }));
}

export function usePromoCampaigns(location?: MerchantLocation | null) {
  const queryClient = useQueryClient();
  const queryKey = ["supabase", "merchant", "promos", location?.id ?? "all"] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => fetchPromos(location),
    ...withSupabaseCaching({ entity: "promos" }),
  });

  const createCampaign = useMutation({
    mutationFn: async (payload: {
      tenantId: string;
      locationId: string | null;
      name: string;
      description?: string;
      epsilon: number;
      budgetCapCents: number;
      frequencyCap: number;
      fairnessConstraints: Record<string, unknown>;
      startsAt?: string;
      endsAt?: string;
    }) => {
      await supabase.from("promo_campaigns").insert({
        tenant_id: payload.tenantId,
        location_id: payload.locationId,
        name: payload.name,
        description: payload.description,
        epsilon: payload.epsilon,
        budget_cap_cents: payload.budgetCapCents,
        frequency_cap: payload.frequencyCap,
        fairness_constraints: payload.fairnessConstraints,
        starts_at: payload.startsAt ?? null,
        ends_at: payload.endsAt ?? null,
        status: "pending_review",
      });
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PromoStatus }) => {
      await supabase
        .from("promo_campaigns")
        .update({ status, reviewed_at: status === "approved" ? new Date().toISOString() : null })
        .eq("id", id);
      await supabase.from("promo_audit_events").insert({
        campaign_id: id,
        action: `status:${status}`,
        detail: { by: "merchant-portal" },
      });
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const recordSpend = useMutation({
    mutationFn: async ({ id, spendCents }: { id: string; spendCents: number }) => {
      const { data, error } = await supabase.rpc<RawPromoRow>("increment_promo_spend", {
        campaign_id: id,
        delta_cents: spendCents,
      });

      if (!error && data) {
        queryClient.setQueryData<PromoCampaign[]>(queryKey, (existing) => {
          if (!existing) return existing;
          return existing.map((campaign) =>
            campaign.id === id
              ? {
                  ...campaign,
                  tenantId: data.tenant_id,
                  locationId: data.location_id,
                  name: data.name,
                  description: data.description,
                  epsilon: data.epsilon ?? campaign.epsilon,
                  budgetCapCents: data.budget_cap_cents ?? campaign.budgetCapCents,
                  spentCents: data.spent_cents ?? campaign.spentCents,
                  frequencyCap: data.frequency_cap ?? campaign.frequencyCap,
                  fairnessConstraints: data.fairness_constraints ?? campaign.fairnessConstraints,
                  status: data.status,
                  startsAt: data.starts_at,
                  endsAt: data.ends_at,
                  createdAt: data.created_at,
                  reviewedAt: data.reviewed_at,
                }
              : campaign
          );
        });
      } else {
        const campaign = queryClient.getQueryData<PromoCampaign[]>(queryKey)?.find((entry) => entry.id === id);
        const current = campaign?.spentCents ?? 0;
        const cap = campaign?.budgetCapCents ?? current + spendCents;
        const nextValue = Math.min(current + spendCents, cap);
        await supabase.from("promo_campaigns").update({ spent_cents: nextValue }).eq("id", id);
      }

      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    campaigns: useMemo(() => query.data ?? [], [query.data]),
    isLoading: query.isLoading,
    createCampaign,
    updateStatus,
    recordSpend,
  };
}
