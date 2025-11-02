import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client";
import type { MerchantLocation } from "@/hooks/useMerchantLocations";

export type TableState = "vacant" | "ordering" | "in_kitchen" | "served" | "bill" | "cleaning";

export interface FloorTable {
  id: string;
  code: string;
  seats: number;
  state: TableState;
  locationId: string;
  layout: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface RawTableRow {
  id: string;
  code: string | null;
  seats: number | null;
  state: TableState | null;
  location_id: string;
  layout: Record<string, unknown> | null;
}

function normaliseLayout(layout: Record<string, unknown> | null | undefined) {
  const base = {
    x: 0,
    y: 0,
    width: 160,
    height: 160,
  };
  if (!layout || typeof layout !== "object") {
    return base;
  }
  return {
    x: typeof layout["x"] === "number" ? (layout["x"] as number) : base.x,
    y: typeof layout["y"] === "number" ? (layout["y"] as number) : base.y,
    width: typeof layout["width"] === "number" ? (layout["width"] as number) : base.width,
    height: typeof layout["height"] === "number" ? (layout["height"] as number) : base.height,
  };
}

async function fetchTables(locationId?: string): Promise<FloorTable[]> {
  let query = supabase
    .from("tables")
    .select("id, code, seats, state, location_id, layout")
    .order("code", { ascending: true });

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? [])
    .filter((row): row is typeof row & { code: string; state: TableState } => 
      Boolean(row?.id && row?.code && row?.location_id)
    )
    .map((row) => ({
      id: row.id,
      code: row.code!,
      seats: row.seats ?? 2,
      state: (row.state as TableState) ?? "vacant",
      locationId: row.location_id,
      layout: normaliseLayout(row.layout as Record<string, unknown> | null),
    }));
}

export function useFloorTables(location?: MerchantLocation | null) {
  const locationId = location?.id;
  const queryClient = useQueryClient();
  const [isSavingLayout, setIsSavingLayout] = useState(false);

  const query = useQuery({
    queryKey: ["merchant", "tables", locationId ?? "all"],
    queryFn: () => fetchTables(locationId),
  });

  useEffect(() => {
    const channel = supabase
      .channel(`merchant-tables-${locationId ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tables" },
        (payload) => {
          const next = payload.new as RawTableRow | null;
          const previous = payload.old as RawTableRow | null;
          if (!next && !previous) {
            return;
          }

          queryClient.setQueryData<FloorTable[]>(["merchant", "tables", locationId ?? "all"], (existing) => {
            const current = existing ?? [];
            if (!next) {
              return current.filter((table) => table.id !== previous?.id);
            }
            if (locationId && next.location_id !== locationId) {
              return current;
            }
            const table: FloorTable = {
              id: next.id,
              code: next.code ?? previous?.code ?? "?",
              seats: next.seats ?? previous?.seats ?? 2,
              state: (next.state ?? previous?.state ?? "vacant") as TableState,
              locationId: next.location_id,
              layout: normaliseLayout(next.layout ?? previous?.layout ?? null),
            };
            const idx = current.findIndex((existingTable) => existingTable.id === table.id);
            if (idx >= 0) {
              const copy = [...current];
              copy[idx] = table;
              return copy;
            }
            return [...current, table];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [locationId, queryClient]);

  const updateTableState = async (tableId: string, nextState: TableState, note?: string) => {
    const currentTables =
      queryClient.getQueryData<FloorTable[]>(["merchant", "tables", locationId ?? "all"]) ?? query.data ?? [];
    const currentTable = currentTables.find((table) => table.id === tableId);

    await supabase.from("tables").update({ state: nextState }).eq("id", tableId);
    await supabase.from("table_state_events").insert({
      table_id: tableId,
      previous_state: currentTable?.state ?? null,
      next_state: nextState,
      notes: note ?? "Manual override from merchant portal",
    });
    queryClient.invalidateQueries({ queryKey: ["merchant", "tables", locationId ?? "all"] });
  };

  const updateLayout = async (tableId: string, layout: FloorTable["layout"]) => {
    setIsSavingLayout(true);
    try {
      await supabase.from("tables").update({ layout }).eq("id", tableId);
      queryClient.setQueryData<FloorTable[]>(["merchant", "tables", locationId ?? "all"], (existing) => {
        if (!existing) return existing;
        return existing.map((table) =>
          table.id === tableId
            ? {
                ...table,
                layout,
              }
            : table
        );
      });
    } finally {
      setIsSavingLayout(false);
    }
  };

  return {
    tables: useMemo(() => query.data ?? [], [query.data]),
    isLoading: query.isLoading,
    isSavingLayout,
    updateTableState,
    updateLayout,
  };
}

export const TABLE_STATE_OPTIONS: { value: TableState; label: string; tone: "neutral" | "positive" | "warning" }[] = [
  { value: "vacant", label: "Vacant", tone: "neutral" },
  { value: "ordering", label: "Ordering", tone: "warning" },
  { value: "in_kitchen", label: "In Kitchen", tone: "warning" },
  { value: "served", label: "Served", tone: "positive" },
  { value: "bill", label: "Bill", tone: "warning" },
  { value: "cleaning", label: "Cleaning", tone: "neutral" },
];
