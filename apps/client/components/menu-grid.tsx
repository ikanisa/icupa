'use client';

import { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@icupa/ui';
import type { MenuCategory, MenuItem } from '../data/menu';
import { MenuItemCard } from './menu-item-card';

interface MenuGridProps {
  categories: MenuCategory[];
  items: MenuItem[];
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
  onSelectItem: (item: MenuItem) => void;
  locale: string;
  currency: 'RWF' | 'EUR';
}

export function MenuGrid({
  categories,
  items,
  activeCategory,
  onCategoryChange,
  onSelectItem,
  locale,
  currency,
}: MenuGridProps) {
  const groupedItems = useMemo(() => {
    return categories.reduce<Record<string, MenuItem[]>>((acc, category) => {
      acc[category.id] = items.filter((item) => item.categoryId === category.id);
      return acc;
    }, {});
  }, [categories, items]);

  return (
    <Tabs value={activeCategory} onValueChange={onCategoryChange} className="w-full">
      <TabsList className="glass-surface flex flex-wrap gap-2 rounded-full bg-white/10 p-1">
        <TabsTrigger value="all" className="rounded-full px-4 py-2 text-sm uppercase tracking-wide">
          All
        </TabsTrigger>
        {categories.map((category) => (
          <TabsTrigger key={category.id} value={category.id} className="rounded-full px-4 py-2 text-sm uppercase tracking-wide">
            {category.name}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="all" className="mt-6 focus:outline-none">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <MenuItemCard key={item.id} item={item} locale={locale} currency={currency} onSelect={onSelectItem} />
          ))}
        </div>
      </TabsContent>
      {categories.map((category) => (
        <TabsContent key={category.id} value={category.id} className="mt-6 focus:outline-none">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {(groupedItems[category.id] ?? []).map((item) => (
              <MenuItemCard key={item.id} item={item} locale={locale} currency={currency} onSelect={onSelectItem} />
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
