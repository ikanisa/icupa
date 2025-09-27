import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabaseBrowser } from "@/lib/supabase-client";
import {
  menuCategories as fallbackCategories,
  menuItems as fallbackItems,
  menuLocations as fallbackLocations,
  allergenOptions,
  dietaryTags,
  type MenuCategory,
  type MenuItem,
  type MenuLocation,
  type RegionCode,
} from "@/data/menu";

type MenuDataPayload = {
  locations: MenuLocation[];
  categories: MenuCategory[];
  items: MenuItem[];
};

type SupabaseLocationRow = {
  id: string;
  tenant_id: string | null;
  name: string;
  region: string | null;
  currency: string | null;
  timezone: string | null;
  settings: Record<string, unknown> | null;
};

type SupabaseCategoryRow = {
  id: string;
  name: string | null;
  sort_order: number | null;
};

type SupabaseItemRow = {
  id: string;
  name: string | null;
  description: string | null;
  price_cents: number | null;
  category_id: string | null;
  location_id: string | null;
  allergens: string[] | null;
  tags: string[] | null;
  is_alcohol: boolean | null;
  is_available: boolean | null;
};

const KNOWN_ALLERGENS = new Set(allergenOptions.map((option) => option.code));
const KNOWN_DIETARY_TAGS = new Set<string>(dietaryTags as unknown as string[]);

const FALLBACK_DATA: MenuDataPayload = {
  locations: fallbackLocations,
  categories: fallbackCategories,
  items: fallbackItems,
};

const fallbackLocationByRegion = new Map<RegionCode, MenuLocation>(
  fallbackLocations.map((location) => [location.region, location])
);

const fallbackCategoryByName = new Map<string, MenuCategory>(
  fallbackCategories.map((category) => [category.name.toLowerCase(), category])
);

const fallbackItemByName = new Map<string, MenuItem>(
  fallbackItems.map((item) => [item.name.toLowerCase(), item])
);

function sanitizeAllergens(input: string[] | null | undefined): MenuItem["allergens"] {
  if (!input) {
    return [];
  }
  return input.filter((value): value is MenuItem["allergens"][number] =>
    KNOWN_ALLERGENS.has(value as MenuItem["allergens"][number])
  );
}

function sanitizeDietaryTags(input: string[] | null | undefined): MenuItem["dietaryTags"] {
  if (!input) {
    return [];
  }
  return input.filter((value): value is MenuItem["dietaryTags"][number] =>
    KNOWN_DIETARY_TAGS.has(value)
  );
}

function resolveLocale(region: RegionCode, settings: Record<string, unknown> | null): string {
  let fromSettings: string | undefined;
  if (settings && typeof settings === "object" && "default_locale" in settings) {
    const candidate = (settings as Record<string, unknown>)["default_locale"];
    if (typeof candidate === "string" && candidate.length > 0) {
      fromSettings = candidate;
    }
  }

  if (fromSettings) {
    return fromSettings;
  }

  if (region === "EU") {
    return fallbackLocationByRegion.get("EU")?.locale ?? "en-MT";
  }
  return fallbackLocationByRegion.get("RW")?.locale ?? "en-RW";
}

function defaultPreparationMinutes(fallback?: MenuItem): number {
  if (fallback) {
    return fallback.preparationMinutes;
  }
  return 12;
}

function defaultRating(fallback?: MenuItem): number {
  if (fallback) {
    return fallback.rating;
  }
  return 4.6;
}

async function fetchMenuFromSupabase(): Promise<MenuDataPayload> {
  const [locationsResponse, categoriesResponse, itemsResponse] = await Promise.all([
    supabaseBrowser
      .from("locations")
      .select<SupabaseLocationRow>("id, tenant_id, name, region, currency, timezone, settings"),
    supabaseBrowser
      .from("categories")
      .select<SupabaseCategoryRow>("id, name, sort_order"),
    supabaseBrowser
      .from("items")
      .select<SupabaseItemRow>(
        "id, name, description, price_cents, category_id, location_id, allergens, tags, is_alcohol, is_available"
      ),
  ]);

  if (locationsResponse.error) {
    throw locationsResponse.error;
  }
  if (categoriesResponse.error) {
    throw categoriesResponse.error;
  }
  if (itemsResponse.error) {
    throw itemsResponse.error;
  }

  const locations: MenuLocation[] = (locationsResponse.data ?? [])
    .filter((row): row is SupabaseLocationRow => Boolean(row?.id && row.name))
    .map((row) => {
      const region = (row.region === "EU" ? "EU" : "RW") as RegionCode;
      const fallback = fallbackLocationByRegion.get(region);
      return {
        id: row.id,
        tenantId: row.tenant_id ?? undefined,
        name: row.name,
        region,
        currency: row.currency === "EUR" ? "EUR" : fallback?.currency ?? "RWF",
        locale: resolveLocale(region, row.settings),
        timezone: row.timezone ?? fallback?.timezone ?? "UTC",
      } satisfies MenuLocation;
    });

  const categories: MenuCategory[] = (categoriesResponse.data ?? [])
    .filter((row): row is SupabaseCategoryRow => Boolean(row?.id && row.name))
    .map((row, index) => {
      const fallback = fallbackCategoryByName.get(row.name!.toLowerCase());
      return {
        id: row.id,
        name: row.name!,
        description: fallback?.description ?? "",
        sortOrder: row.sort_order ?? fallback?.sortOrder ?? index,
      } satisfies MenuCategory;
    });

  const items: MenuItem[] = (itemsResponse.data ?? [])
    .map((row) => {
      if (!row?.id || !row.name) {
        return null;
      }
      const fallback = fallbackItemByName.get(row.name.toLowerCase());
      const locationId = row.location_id ?? fallback?.locationIds[0];
      if (!locationId) {
        return null;
      }
      const categoryId = row.category_id ?? fallback?.categoryId ?? "uncategorised";
      const priceCents = row.price_cents ?? fallback?.priceCents ?? 0;
      return {
        id: row.id,
        name: row.name,
        description: row.description ?? fallback?.description ?? "",
        categoryId,
        priceCents,
        locationIds: [locationId],
        allergens: sanitizeAllergens(row.allergens ?? fallback?.allergens),
        dietaryTags: sanitizeDietaryTags(row.tags ?? fallback?.dietaryTags),
        preparationMinutes: defaultPreparationMinutes(fallback),
        rating: defaultRating(fallback),
        isAvailable: row.is_available ?? fallback?.isAvailable ?? true,
        spiceLevel: fallback?.spiceLevel,
        containsAlcohol: row.is_alcohol ?? fallback?.containsAlcohol ?? false,
        highlight: fallback?.highlight,
        heroImage: fallback?.heroImage,
        recommendedPairings: fallback?.recommendedPairings ?? [],
      } satisfies MenuItem;
    })
    .filter((item): item is MenuItem => Boolean(item));

  return { locations, categories, items };
}

export type MenuDataSource = "loading" | "supabase" | "static";

export function useMenuData() {
  const query = useQuery<MenuDataPayload>({
    queryKey: ["menu-data"],
    queryFn: fetchMenuFromSupabase,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const result = useMemo(() => {
    if (query.isSuccess && query.data.locations.length > 0 && query.data.items.length > 0) {
      return {
        data: query.data,
        source: "supabase" as MenuDataSource,
      };
    }
    if (query.isError) {
      return {
        data: FALLBACK_DATA,
        source: "static" as MenuDataSource,
      };
    }
    if (query.isSuccess) {
      return {
        data: FALLBACK_DATA,
        source: "static" as MenuDataSource,
      };
    }
    return {
      data: FALLBACK_DATA,
      source: "loading" as MenuDataSource,
    };
  }, [query.data, query.isError, query.isSuccess]);

  return {
    ...query,
    locations: result.data.locations,
    categories: result.data.categories,
    items: result.data.items,
    source: result.source,
  };
}
