'use client';

import { useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { MenuHeader } from '../components/menu-header';
import { MenuFiltersSheet, type MenuFilters } from '../components/menu-filters-sheet';
import { MenuGrid } from '../components/menu-grid';
import { menuCategories, menuItems, menuLocations, menuModifierGroups, type MenuItem } from '../data/menu';
import { MenuItemDrawer } from '../components/menu-item-drawer';
import { ActionDock } from '../components/action-dock';

const DEFAULT_FILTERS: MenuFilters = {
  excludedAllergens: [],
  dietaryTags: [],
  availableOnly: true,
  maxPrepMinutes: undefined,
};

const fuse = new Fuse(menuItems, {
  keys: ['name', 'description', 'dietaryTags'],
  threshold: 0.35,
});

export default function MenuPage() {
  const [filters, setFilters] = useState<MenuFilters>(DEFAULT_FILTERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const location = menuLocations[0];

  const filteredItems = useMemo(() => {
    let working = menuItems.filter((item) => (filters.availableOnly ? item.isAvailable : true));
    if (filters.excludedAllergens.length > 0) {
      const avoid = new Set(filters.excludedAllergens);
      working = working.filter((item) => item.allergens.every((allergen) => !avoid.has(allergen)));
    }
    if (filters.dietaryTags.length > 0) {
      const required = new Set(filters.dietaryTags);
      working = working.filter((item) => item.dietaryTags.some((tag) => required.has(tag)));
    }
    if (filters.maxPrepMinutes) {
      working = working.filter((item) => item.preparationMinutes <= filters.maxPrepMinutes!);
    }
    if (searchQuery.trim().length > 0) {
      const results = fuse.search(searchQuery.trim());
      const ids = new Set(results.map((result) => result.item.id));
      working = working.filter((item) => ids.has(item.id));
    }
    return working;
  }, [filters, searchQuery]);

  return (
    <main id="content" className="relative flex-1 pb-32">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-14">
        <header className="space-y-4 text-white">
          <span className="text-sm uppercase tracking-[0.35em] text-white/60">ICUPA · Kigali Harvest</span>
          <h1 className="text-balance text-4xl font-semibold md:text-5xl">
            Dine effortlessly with our aurora-inspired experience
          </h1>
          <p className="max-w-2xl text-lg text-white/70">
            Browse live menus, ask our AI waiter anything, and split or pay without waiting for staff. Everything syncs to your table session.
          </p>
        </header>

        <MenuHeader
          searchQuery={searchQuery}
          onSearchChange={(value) => setSearchQuery(value)}
          onOpenFilters={() => setIsFilterSheetOpen(true)}
        />

        <MenuFiltersSheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen} filters={filters} onChange={setFilters} />

        <MenuGrid
          categories={menuCategories}
          items={filteredItems}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          onSelectItem={(item) => setSelectedItem(item)}
          locale={location.locale}
          currency={location.currency}
        />
      </div>

      <MenuItemDrawer
        item={selectedItem}
        modifierGroups={selectedItem ? menuModifierGroups[selectedItem.id] ?? [] : []}
        locale={location.locale}
        currency={location.currency}
        onClose={() => setSelectedItem(null)}
      />

      <ActionDock locale={location.locale} currency={location.currency} />
    </main>
  );
}
