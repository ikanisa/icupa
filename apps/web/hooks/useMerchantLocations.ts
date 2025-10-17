import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client";

export interface MerchantLocation {
  id: string;
  tenantId: string;
  name: string;
  region: string;
  currency: string;
  timezone: string;
  taxRate: number;
}

async function fetchLocations(): Promise<MerchantLocation[]> {
  const { data, error } = await supabase
    .from("locations")
    .select("id, tenant_id, name, region, currency, timezone, settings")
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
      taxRate: (() => {
        const settings = (row as { settings?: Record<string, unknown> | null }).settings;
        if (settings && typeof settings === "object") {
          const candidate = (settings as Record<string, unknown>)["tax_rate"];
          if (typeof candidate === "number" && Number.isFinite(candidate)) {
            return Math.max(0, Math.min(candidate, 1));
          }
          const percent = (settings as Record<string, unknown>)["tax_rate_percent"];
          if (typeof percent === "number" && Number.isFinite(percent)) {
            return Math.max(0, Math.min(percent / 100, 1));
          }
        }
        return row.region === "EU" ? 0.07 : 0.18;
      })(),
    }));
}

export function useMerchantLocations() {
  return useQuery({
    queryKey: ["merchant", "locations"],
    queryFn: fetchLocations,
    staleTime: 60_000,
  });
}
