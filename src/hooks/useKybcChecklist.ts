import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type KybcStatus = "pending" | "in_progress" | "blocked" | "resolved";

export interface KybcChecklistItem {
  id: string;
  tenantId: string;
  region: "RW" | "EU";
  requirement: string;
  status: KybcStatus;
  notes: Record<string, unknown>;
  lastVerifiedAt: string | null;
  updatedAt: string;
}

interface KybcRow {
  id: string;
  tenant_id: string;
  region: "RW" | "EU";
  requirement: string;
  status: KybcStatus;
  notes: Record<string, unknown> | null;
  last_verified_at: string | null;
  updated_at: string;
}

const KYBC_QUERY_TTL = 30_000;

async function fetchKybcChecklist(tenantId: string): Promise<KybcChecklistItem[]> {
  const { data, error } = await supabase
    .from("kybc_checklist_items")
    .select("id, tenant_id, region, requirement, status, notes, last_verified_at, updated_at")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as KybcRow[] | null)?.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    region: row.region,
    requirement: row.requirement,
    status: row.status,
    notes: row.notes ?? {},
    lastVerifiedAt: row.last_verified_at,
    updatedAt: row.updated_at,
  })) ?? [];
}

export function useKybcChecklist(tenantId: string | null) {
  return useQuery({
    queryKey: ["admin", "kybc-checklist", tenantId],
    queryFn: () => fetchKybcChecklist(tenantId ?? ""),
    enabled: Boolean(tenantId),
    staleTime: KYBC_QUERY_TTL,
  });
}

export interface CreateKybcItemInput {
  tenantId: string;
  region: "RW" | "EU";
  requirement: string;
  notes?: Record<string, unknown>;
}

async function createKybcItem(input: CreateKybcItemInput) {
  const payload: Record<string, unknown> = {
    tenant_id: input.tenantId,
    region: input.region,
    requirement: input.requirement,
    status: "pending",
    notes: input.notes ?? {},
  };

  const { error } = await supabase.from("kybc_checklist_items").insert([payload]);

  if (error) {
    throw error;
  }
}

export function useCreateKybcItem(tenantId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateKybcItemInput) => createKybcItem(input),
    onSuccess: (_, variables) => {
      if (!tenantId) return;
      queryClient.invalidateQueries({ queryKey: ["admin", "kybc-checklist", tenantId] });
      if (variables.tenantId !== tenantId) {
        queryClient.invalidateQueries({ queryKey: ["admin", "kybc-checklist", variables.tenantId] });
      }
    },
  });
}

export interface UpdateKybcItemInput {
  id: string;
  tenantId: string;
  patch: Partial<{
    status: KybcStatus;
    notes: Record<string, unknown>;
  }>;
}

async function updateKybcItem(input: UpdateKybcItemInput) {
  const payload: Record<string, unknown> = {};
  if (input.patch.status) {
    payload.status = input.patch.status;
  }
  if (input.patch.notes) {
    payload.notes = input.patch.notes;
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  const { error } = await supabase
    .from("kybc_checklist_items")
    .update(payload)
    .eq("id", input.id)
    .eq("tenant_id", input.tenantId);

  if (error) {
    throw error;
  }
}

export function useUpdateKybcItem(tenantId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateKybcItemInput) => updateKybcItem(input),
    onSuccess: (_, variables) => {
      if (!tenantId) return;
      queryClient.invalidateQueries({ queryKey: ["admin", "kybc-checklist", tenantId] });
      if (variables.tenantId !== tenantId) {
        queryClient.invalidateQueries({ queryKey: ["admin", "kybc-checklist", variables.tenantId] });
      }
    },
  });
}
