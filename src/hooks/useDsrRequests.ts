import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DsrRequestStatus = "queued" | "in_progress" | "completed" | "failed";
export type DsrRequestType = "export" | "delete";

export interface DsrRequest {
  id: string;
  tenantId: string | null;
  region: "RW" | "EU";
  subjectIdentifier: string;
  contactEmail: string | null;
  requestType: DsrRequestType;
  status: DsrRequestStatus;
  requestedAt: string;
  completedAt: string | null;
  notes: Record<string, unknown>;
}

async function fetchDsrRequests(tenantId: string): Promise<DsrRequest[]> {
  const { data, error } = await supabase
    .from("dsr_requests")
    .select(
      "id, tenant_id, region, subject_identifier, contact_email, request_type, status, requested_at, completed_at, notes"
    )
    .eq("tenant_id", tenantId)
    .order("requested_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id!,
    tenantId: row.tenant_id ?? null,
    region: (row.region as "RW" | "EU") ?? "RW",
    subjectIdentifier: row.subject_identifier ?? "",
    contactEmail: row.contact_email ?? null,
    requestType: (row.request_type as DsrRequestType) ?? "export",
    status: (row.status as DsrRequestStatus) ?? "queued",
    requestedAt: row.requested_at ?? new Date().toISOString(),
    completedAt: row.completed_at ?? null,
    notes: (row.notes ?? {}) as Record<string, unknown>,
  }));
}

export function useDsrRequests(tenantId: string | null) {
  return useQuery({
    queryKey: ["admin", "dsr-requests", tenantId],
    queryFn: () => fetchDsrRequests(tenantId ?? ""),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
  });
}

export interface CreateDsrRequestInput {
  tenantId: string;
  region: "RW" | "EU";
  subjectIdentifier: string;
  contactEmail?: string;
  requestType: DsrRequestType;
  notes?: string;
}

async function createDsrRequest(input: CreateDsrRequestInput) {
  const payload: Record<string, unknown> = {
    tenant_id: input.tenantId,
    region: input.region,
    subject_identifier: input.subjectIdentifier,
    request_type: input.requestType,
  };

  if (input.contactEmail) {
    payload.contact_email = input.contactEmail;
  }

  if (input.notes) {
    payload.notes = {
      source: "admin_console",
      notes: input.notes,
    };
  }

  const { error } = await supabase.from("dsr_requests").insert([payload]);

  if (error) {
    throw error;
  }
}

export function useCreateDsrRequest(tenantId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDsrRequestInput) => createDsrRequest(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "dsr-requests", variables.tenantId] });
      if (tenantId && tenantId !== variables.tenantId) {
        queryClient.invalidateQueries({ queryKey: ["admin", "dsr-requests", tenantId] });
      }
    },
  });
}

export interface UpdateDsrRequestInput {
  id: string;
  tenantId: string;
  patch: Partial<{
    status: DsrRequestStatus;
    contactEmail: string | null;
    notes: string | null;
  }>;
}

async function updateDsrRequest(input: UpdateDsrRequestInput) {
  const payload: Record<string, unknown> = {};

  if (input.patch.status) {
    payload.status = input.patch.status;
  }

  if (input.patch.contactEmail !== undefined) {
    payload.contact_email = input.patch.contactEmail;
  }

  if (input.patch.notes !== undefined) {
    payload.notes = input.patch.notes
      ? {
          source: "admin_console",
          notes: input.patch.notes,
        }
      : {};
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  const { error } = await supabase
    .from("dsr_requests")
    .update(payload)
    .eq("id", input.id)
    .eq("tenant_id", input.tenantId);

  if (error) {
    throw error;
  }
}

export function useUpdateDsrRequest(tenantId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDsrRequestInput) => updateDsrRequest(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "dsr-requests", variables.tenantId] });
      if (tenantId && tenantId !== variables.tenantId) {
        queryClient.invalidateQueries({ queryKey: ["admin", "dsr-requests", tenantId] });
      }
    },
  });
}
