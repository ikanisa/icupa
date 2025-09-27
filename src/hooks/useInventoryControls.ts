import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MerchantLocation } from "@/hooks/useMerchantLocations";

export interface InventoryRecord {
  id: string;
  sku: string;
  displayName: string;
  quantity: number;
  parLevel: number;
  reorderThreshold: number;
  auto86: boolean;
  auto86Level: "L0" | "L1" | "L2";
  updatedAt?: string;
  locationId: string;
}

interface RawInventoryRow {
  id: string;
  sku: string;
  display_name: string;
  quantity: number | null;
  par_level: number | null;
  reorder_threshold: number | null;
  auto_86: boolean | null;
  auto_86_level: string | null;
  updated_at: string | null;
  location_id: string;
}

async function fetchInventory(location?: MerchantLocation | null): Promise<InventoryRecord[]> {
  let query = supabase
    .from("inventory_items")
    .select<RawInventoryRow>(
      "id, sku, display_name, quantity, par_level, reorder_threshold, auto_86, auto_86_level, updated_at, location_id"
    )
    .order("display_name", { ascending: true });

  if (location) {
    query = query.eq("location_id", location.id);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    sku: row.sku,
    displayName: row.display_name,
    quantity: row.quantity ?? 0,
    parLevel: row.par_level ?? 0,
    reorderThreshold: row.reorder_threshold ?? 0,
    auto86: row.auto_86 ?? false,
    auto86Level: (row.auto_86_level ?? "L0") as InventoryRecord["auto86Level"],
    updatedAt: row.updated_at ?? undefined,
    locationId: row.location_id,
  }));
}

export function useInventoryControls(location?: MerchantLocation | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["merchant", "inventory", location?.id ?? "all"],
    queryFn: () => fetchInventory(location),
  });

  useEffect(() => {
    const channel = supabase
      .channel(`merchant-inventory-${location?.id ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory_items" },
        () => queryClient.invalidateQueries({ queryKey: ["merchant", "inventory", location?.id ?? "all"] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [location?.id, queryClient]);

  const updateInventory = useMutation({
    mutationFn: async ({
      id,
      quantity,
      reorderThreshold,
      auto86,
      auto86Level,
    }: {
      id: string;
      quantity: number;
      reorderThreshold: number;
      auto86: boolean;
      auto86Level: InventoryRecord["auto86Level"];
    }) => {
      await supabase
        .from("inventory_items")
        .update({
          quantity,
          reorder_threshold: reorderThreshold,
          auto_86: auto86,
          auto_86_level: auto86Level,
        })
        .eq("id", id);
      queryClient.invalidateQueries({ queryKey: ["merchant", "inventory", location?.id ?? "all"] });
    },
  });

  return {
    records: query.data ?? [],
    isLoading: query.isLoading,
    updateInventory,
  };
}
