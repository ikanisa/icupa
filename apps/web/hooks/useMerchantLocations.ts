import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client";

export interface MerchantLocation {
  id: string;
  tenantId: string;
  name: string;
  region: string;
  currency: string;
  timezone: string;
}

async function fetchLocations(): Promise<MerchantLocation[]> {
  const { data, error } = await supabase
    .from("locations")
    .select("id, tenant_id, name, region, currency, timezone")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .filter((row): row is NonNullable<typeof row> & { tenant_id: string } => Boolean(row?.id && row?.tenant_id))
    .map((row) => ({
      id: row.id!,
      tenantId: row.tenant_id!,
      name: row.name ?? "Unknown location",
      region: row.region ?? "RW",
      currency: row.currency ?? "RWF",
      timezone: row.timezone ?? "UTC",
    }));
}

export function useMerchantLocations() {
  return useQuery({
    queryKey: ["merchant", "locations"],
    queryFn: fetchLocations,
    staleTime: 60_000,
  });
}
