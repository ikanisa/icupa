import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MerchantLocation } from "@/hooks/useMerchantLocations";

export interface ManagedMenuItem {
  id: string;
  name: string;
  description: string;
  isAvailable: boolean;
  priceCents: number;
  menuId: string;
  menuName?: string;
  locationId?: string;
}

export interface CopySuggestion {
  id: string;
  itemId: string;
  locale: string;
  tone?: string | null;
  suggestedName: string;
  suggestedDescription: string;
  rationale?: string | null;
  status: "pending" | "approved" | "rejected";
  metadata: Record<string, unknown>;
  createdAt: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
  rejectedReason?: string | null;
  currentName?: string;
  currentDescription?: string;
}

interface RawMenuItem {
  id: string;
  name: string | null;
  description: string | null;
  is_available: boolean | null;
  price_cents: number | null;
  menu_id: string | null;
  menus?: { id: string; name: string | null; location_id: string | null } | null;
}

interface RawSuggestionRow {
  id: string;
  item_id: string;
  locale: string;
  tone: string | null;
  suggested_name: string;
  suggested_description: string;
  rationale: string | null;
  status: "pending" | "approved" | "rejected";
  metadata: Record<string, unknown> | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  rejected_reason: string | null;
  items?: { name: string | null; description: string | null; menus?: { location_id: string | null } | null } | null;
}

async function fetchMenuItems(location?: MerchantLocation | null): Promise<ManagedMenuItem[]> {
  let query = supabase
    .from("items")
    .select<RawMenuItem>(
      "id, name, description, is_available, price_cents, menu_id, menus:menus!items_menu_id_fkey(id, name, location_id)"
    )
    .order("name", { ascending: true });

  if (location) {
    query = query.eq("menus.location_id", location.id);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? [])
    .filter((row): row is RawMenuItem & { name: string; menu_id: string } => Boolean(row?.id && row?.name && row?.menu_id))
    .map((row) => ({
      id: row.id,
      name: row.name!,
      description: row.description ?? "",
      isAvailable: row.is_available ?? true,
      priceCents: row.price_cents ?? 0,
      menuId: row.menu_id!,
      menuName: row.menus?.name ?? undefined,
      locationId: row.menus?.location_id ?? undefined,
    }));
}

async function fetchSuggestions(location?: MerchantLocation | null): Promise<CopySuggestion[]> {
  const { data, error } = await supabase
    .from("menu_copy_suggestions")
    .select<RawSuggestionRow>(
      "id, item_id, locale, tone, suggested_name, suggested_description, rationale, status, metadata, created_at, approved_at, approved_by, rejected_reason, items:items(name, description, menus:menus!items_menu_id_fkey(location_id))"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .filter((row) => {
      if (!location) {
        return true;
      }
      const locationId = row.items?.menus?.location_id;
      return !locationId || locationId === location.id;
    })
    .map((row) => ({
      id: row.id,
      itemId: row.item_id,
      locale: row.locale,
      tone: row.tone,
      suggestedName: row.suggested_name,
      suggestedDescription: row.suggested_description,
      rationale: row.rationale,
      status: row.status,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      approvedAt: row.approved_at,
      approvedBy: row.approved_by,
      rejectedReason: row.rejected_reason,
      currentName: row.items?.name ?? undefined,
      currentDescription: row.items?.description ?? undefined,
    }));
}

function craftSuggestionDraft(item: ManagedMenuItem): { suggested_name: string; suggested_description: string; rationale: string } {
  const suffix = item.menuName ? `${item.menuName} Signature` : "Chef's Pick";
  const suggestedName = item.name.includes("Signature") ? item.name : `${item.name} ${suffix}`;
  const suggestedDescription = item.description.length
    ? `${item.description} Served with seasonal garnishes and plated for easy sharing.`
    : "A house favourite prepared fresh with locally sourced ingredients and plated for sharing.";
  return {
    suggested_name: suggestedName,
    suggested_description: suggestedDescription,
    rationale: "Auto-generated draft awaiting human approval",
  };
}

export function useMenuManager(location?: MerchantLocation | null) {
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ["merchant", "menu", location?.id ?? "all"],
    queryFn: () => fetchMenuItems(location),
  });

  const suggestionsQuery = useQuery({
    queryKey: ["merchant", "menu", "suggestions", location?.id ?? "all"],
    queryFn: () => fetchSuggestions(location),
  });

  const toggleAvailability = useMutation({
    mutationFn: async ({ itemId, isAvailable }: { itemId: string; isAvailable: boolean }) => {
      await supabase.from("items").update({ is_available: isAvailable }).eq("id", itemId);
      queryClient.setQueryData<ManagedMenuItem[]>(["merchant", "menu", location?.id ?? "all"], (existing) => {
        if (!existing) return existing;
        return existing.map((item) => (item.id === itemId ? { ...item, isAvailable } : item));
      });
    },
  });

  const requestSuggestion = useMutation({
    mutationFn: async (item: ManagedMenuItem) => {
      const draft = craftSuggestionDraft(item);
      await supabase.from("menu_copy_suggestions").insert({
        item_id: item.id,
        locale: "en",
        tone: "friendly",
        suggested_name: draft.suggested_name,
        suggested_description: draft.suggested_description,
        rationale: draft.rationale,
        metadata: { source: "client-heuristic" },
      });
      await suggestionsQuery.refetch();
    },
  });

  const approveSuggestion = useMutation({
    mutationFn: async (suggestion: CopySuggestion) => {
      const { data } = await supabase.auth.getUser();
      const approverId = data?.user?.id ?? null;
      await supabase
        .from("items")
        .update({ name: suggestion.suggestedName, description: suggestion.suggestedDescription })
        .eq("id", suggestion.itemId);
      await supabase
        .from("menu_copy_suggestions")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: approverId,
        })
        .eq("id", suggestion.id);
      queryClient.invalidateQueries({ queryKey: ["merchant", "menu", location?.id ?? "all"] });
      await suggestionsQuery.refetch();
    },
  });

  const rejectSuggestion = useMutation({
    mutationFn: async ({ suggestion, reason }: { suggestion: CopySuggestion; reason: string }) => {
      await supabase
        .from("menu_copy_suggestions")
        .update({ status: "rejected", rejected_reason: reason })
        .eq("id", suggestion.id);
      await suggestionsQuery.refetch();
    },
  });

  return {
    items: useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]),
    suggestions: useMemo(() => suggestionsQuery.data ?? [], [suggestionsQuery.data]),
    isLoading: itemsQuery.isLoading || suggestionsQuery.isLoading,
    toggleAvailability,
    requestSuggestion,
    approveSuggestion,
    rejectSuggestion,
  };
}
