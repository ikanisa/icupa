"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client";
import { useCallback } from "react";

export interface MenuIngestionSummary {
  id: string;
  status: string;
  originalFilename?: string | null;
  itemsCount: number;
  pagesProcessed: number;
  updatedAt: string;
  createdAt: string;
  currency?: string | null;
  errors?: unknown[];
  metadata?: Record<string, unknown> | null;
  locationId?: string | null;
}

export interface MenuIngestionDetail extends MenuIngestionSummary {
  structuredJson?: Record<string, unknown> | null;
  rawText?: string | null;
  staging: MenuIngestionItem[];
}

export interface MenuIngestionItem {
  id: string;
  ingestionId: string;
  categoryName: string | null;
  name: string;
  description: string | null;
  priceCents: number | null;
  currency: string | null;
  allergens: string[];
  tags: string[];
  isAlcohol: boolean;
  confidence: number | null;
  flags: Record<string, unknown> | null;
}

function mapSummary(row: Record<string, any>): MenuIngestionSummary {
  return {
    id: row.id,
    status: row.status,
    originalFilename: row.original_filename,
    itemsCount: row.items_count ?? 0,
    pagesProcessed: row.pages_processed ?? 0,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    currency: row.currency,
    errors: row.errors ?? [],
    metadata: row.metadata ?? {},
    locationId: row.location_id ?? null,
  };
}

function mapItem(row: Record<string, any>): MenuIngestionItem {
  return {
    id: row.id,
    ingestionId: row.ingestion_id,
    categoryName: row.category_name,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    currency: row.currency,
    allergens: row.allergens ?? [],
    tags: row.tags ?? [],
    isAlcohol: Boolean(row.is_alcohol),
    confidence: row.confidence,
    flags: row.flags ?? {},
  };
}

async function fetchIngestions(locationId?: string): Promise<MenuIngestionSummary[]> {
  let query = supabase
    .from("menu_ingestions")
    .select(
      "id, status, original_filename, items_count, pages_processed, updated_at, created_at, currency, errors, metadata, location_id"
    )
    .order("updated_at", { ascending: false });

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map(mapSummary);
}

async function fetchIngestionDetail(ingestionId: string): Promise<MenuIngestionDetail | null> {
  const { data, error } = await supabase
    .from("menu_ingestions")
    .select("id, tenant_id, location_id, status, original_filename, items_count, pages_processed, updated_at, created_at, currency, errors, metadata, structured_json, raw_text")
    .eq("id", ingestionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const { data: items, error: itemsError } = await supabase
    .from("menu_items_staging")
    .select("id, ingestion_id, category_name, name, description, price_cents, currency, allergens, tags, is_alcohol, confidence, flags")
    .eq("ingestion_id", ingestionId)
    .order("category_name", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (itemsError) {
    throw itemsError;
  }

  const summary = mapSummary(data);

  return {
    ...summary,
    structuredJson: data.structured_json ?? null,
    rawText: data.raw_text ?? null,
    staging: (items ?? []).map(mapItem),
  };
}

export function useMenuIngestions(locationId?: string) {
  return useQuery({
    queryKey: ["merchant", "ingestions", locationId ?? "all"],
    queryFn: () => fetchIngestions(locationId),
    refetchInterval: 30_000,
  });
}

export function useMenuIngestionDetail(ingestionId?: string) {
  return useQuery({
    queryKey: ["merchant", "ingestions", ingestionId ?? "detail"],
    queryFn: () => (ingestionId ? fetchIngestionDetail(ingestionId) : Promise.resolve(null)),
    enabled: Boolean(ingestionId),
    refetchInterval: 20_000,
  });
}

export function useUpdateStagingItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      ingestionId: string;
      itemId: string;
      patch: Partial<{ description: string | null; price_cents: number | null; currency: string | null; category_name: string | null; allergens: string[]; tags: string[]; is_alcohol: boolean; flags: Record<string, unknown> }>;
    }) => {
      const { ingestionId, itemId, patch } = payload;
      const { error } = await supabase
        .from("menu_items_staging")
        .update({
          description: patch.description,
          price_cents: patch.price_cents,
          currency: patch.currency,
          category_name: patch.category_name,
          allergens: patch.allergens,
          tags: patch.tags,
          is_alcohol: patch.is_alcohol,
          flags: patch.flags,
        })
        .eq("id", itemId)
        .eq("ingestion_id", ingestionId);

      if (error) {
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["merchant", "ingestions", variables.ingestionId] });
      queryClient.invalidateQueries({ queryKey: ["merchant", "ingestions", "all"] });
    },
  });
}

export function useDeleteStagingItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ingestionId, itemId }: { ingestionId: string; itemId: string }) => {
      const { error } = await supabase.from("menu_items_staging").delete().eq("id", itemId).eq("ingestion_id", ingestionId);
      if (error) {
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["merchant", "ingestions", variables.ingestionId] });
    },
  });
}

export function usePublishIngestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ingestionId, menuId }: { ingestionId: string; menuId: string }) => {
      const { data, error } = await supabase.functions.invoke<{
        published: boolean;
        items_upserted: number;
        categories_created: number;
        version: number;
      }>("ingest_menu_publish", {
        body: { ingestion_id: ingestionId, menu_id: menuId },
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["merchant", "ingestions", variables.ingestionId] });
      queryClient.invalidateQueries({ queryKey: ["merchant", "ingestions", "all"] });
    },
  });
}

export function useProcessIngestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ingestionId }: { ingestionId: string }) => {
      const { data, error } = await supabase.functions.invoke<{
        ok: boolean;
        items_count: number;
        pages_processed: number;
      }>("ingest_menu_process", {
        body: { ingestion_id: ingestionId },
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["merchant", "ingestions", variables.ingestionId] });
      queryClient.invalidateQueries({ queryKey: ["merchant", "ingestions", "all"] });
    },
  });
}

export function useSignedPreviewUrl() {
  return useCallback(async (path: string | null | undefined) => {
    if (!path) return null;
    const { data, error } = await supabase.storage.from("menu_images").createSignedUrl(path, 300);
    if (error) {
      console.error("Failed to sign preview URL", error);
      return null;
    }
    return data?.signedUrl ?? null;
  }, []);
}
