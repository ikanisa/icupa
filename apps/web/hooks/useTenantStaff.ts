import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client";

export interface TenantStaffMember {
  userId: string;
  role: string;
  grantedAt: string | null;
  grantedBy: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  whatsappNumber: string | null;
  whatsappVerifiedAt: string | null;
}

interface StaffResponse {
  members?: TenantStaffMember[];
  error?: unknown;
}

async function fetchTenantStaff(tenantId: string | null): Promise<TenantStaffMember[]> {
  if (!tenantId) {
    return [];
  }

  const { data, error } = await supabase.functions.invoke<StaffResponse>("admin/user_roles", {
    body: { action: "list", tenantId },
  });

  if (error) {
    throw error;
  }

  if (!data) {
    return [];
  }

  if ("error" in data && data.error) {
    throw new Error("Failed to load staff members");
  }

  return (data.members ?? []).map((member) => ({
    userId: member.userId,
    role: member.role,
    grantedAt: member.grantedAt ?? null,
    grantedBy: member.grantedBy ?? null,
    displayName: member.displayName ?? null,
    avatarUrl: member.avatarUrl ?? null,
    email: member.email ?? null,
    emailConfirmedAt: member.emailConfirmedAt ?? null,
    lastSignInAt: member.lastSignInAt ?? null,
    whatsappNumber: member.whatsappNumber ?? null,
    whatsappVerifiedAt: member.whatsappVerifiedAt ?? null,
  }));
}

export function useTenantStaff(tenantId: string | null) {
  return useQuery({
    queryKey: ["admin", "tenant-staff", tenantId],
    queryFn: () => fetchTenantStaff(tenantId),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
  });
}
