import { useMemo } from "react";
import type { MenuCategory, MenuItem } from "@/data/menu";

interface UseLocationMenuOptions {
  items: MenuItem[];
  categories: MenuCategory[];
  selectedLocationId: string;
}

interface UseLocationMenuResult {
  locationItems: MenuItem[];
  locationCategories: MenuCategory[];
}

export function useLocationMenu({
  items,
  categories,
  selectedLocationId,
}: UseLocationMenuOptions): UseLocationMenuResult {
  const locationItems = useMemo(() => {
    if (!selectedLocationId) {
      return items;
    }
    return items.filter((item) => item.locationIds.includes(selectedLocationId));
  }, [items, selectedLocationId]);

  const locationCategories = useMemo(() => {
    if (!selectedLocationId) {
      return [];
    }

    const relevantCategoryIds = new Set(locationItems.map((item) => item.categoryId));
    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const derived: MenuCategory[] = [];

    relevantCategoryIds.forEach((categoryId) => {
      const matched = categoryMap.get(categoryId);
      if (matched) {
        derived.push(matched);
      } else {
        derived.push({ id: categoryId, name: categoryId, description: "" });
      }
    });

    return derived.sort((a, b) => {
      const orderA = a.sortOrder ?? Number.POSITIVE_INFINITY;
      const orderB = b.sortOrder ?? Number.POSITIVE_INFINITY;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name);
    });
  }, [categories, locationItems, selectedLocationId]);

  return { locationItems, locationCategories };
}
