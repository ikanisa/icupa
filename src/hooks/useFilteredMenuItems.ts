import { useMemo } from "react";
import Fuse from "fuse.js";
import type { MenuItem } from "@/data/menu";
import type { MenuFilters } from "@/components/client/MenuFiltersSheet";

interface UseFilteredMenuItemsOptions {
  items: MenuItem[];
  activeCategory: string;
  filters: MenuFilters;
  ageGateChoice: "unknown" | "verified" | "declined";
  searchQuery: string;
}

export function useFilteredMenuItems({
  items,
  activeCategory,
  filters,
  ageGateChoice,
  searchQuery,
}: UseFilteredMenuItemsOptions): MenuItem[] {
  return useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    const base = items
      .filter((item) => (activeCategory === "all" ? true : item.categoryId === activeCategory))
      .filter((item) => (filters.availableOnly ? item.isAvailable : true))
      .filter((item) => (ageGateChoice === "declined" ? !item.containsAlcohol : true))
      .filter((item) => (filters.maxPrepMinutes ? item.preparationMinutes <= filters.maxPrepMinutes : true))
      .filter((item) =>
        filters.excludedAllergens.length === 0
          ? true
          : !item.allergens.some((allergen) => filters.excludedAllergens.includes(allergen))
      )
      .filter((item) =>
        filters.dietaryTags.length === 0
          ? true
          : filters.dietaryTags.every((tag) => item.dietaryTags.includes(tag))
      );

    if (normalizedSearch.length >= 2) {
      const fuse = new Fuse(base, {
        keys: [
          { name: "name", weight: 0.45 },
          { name: "description", weight: 0.3 },
          { name: "dietaryTags", weight: 0.15 },
          { name: "recommendedPairings", weight: 0.1 },
        ],
        threshold: 0.38,
        includeScore: true,
      });

      return fuse.search(normalizedSearch).map((result) => result.item);
    }

    if (normalizedSearch.length === 1) {
      return base.filter((item) =>
        [item.name, item.description, ...(item.recommendedPairings ?? [])]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      );
    }

    return base;
  }, [activeCategory, ageGateChoice, filters, items, searchQuery]);
}
