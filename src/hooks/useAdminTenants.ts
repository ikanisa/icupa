import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PLATFORM_TENANT_ID = "__global__";

export interface AdminTenant {
  id: string;
  name: string;
  region: "RW" | "EU";
  currency: string;
  scope: "tenant" | "platform";
}

async function fetchAdminTenants(): Promise<AdminTenant[]> {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, region, settings")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  const tenants = (data ?? [])
    .filter((row): row is NonNullable<typeof row> & { id: string; name: string; region: string; settings?: Record<string, unknown> } =>
      Boolean(row?.id && row?.name && row?.region),
    )
    .map((row) => {
      const settings = (row.settings ?? {}) as { currency?: string };
      return {
        id: row.id,
        name: row.name,
        region: (row.region as "RW" | "EU") ?? "RW",
        currency: settings.currency ?? (row.region === "EU" ? "EUR" : "RWF"),
        scope: "tenant" as const,
      } satisfies AdminTenant;
    });

  tenants.push({
    id: PLATFORM_TENANT_ID,
    name: "Platform defaults",
    region: "EU",
    currency: "EUR",
    scope: "platform",
  });

  return tenants;
}

export function useAdminTenants() {
  return useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: fetchAdminTenants,
    staleTime: 60_000,
  });
}
