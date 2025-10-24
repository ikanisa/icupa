'use client';

import { useRouter } from 'next/navigation';
import type { MenuItem, MenuModifierGroup, MenuLocation } from '../data/menu';
import { MenuItemDrawer } from './menu-item-drawer';

interface ItemDetailScreenProps {
  item: MenuItem;
  modifierGroups: MenuModifierGroup[];
  location: MenuLocation;
}

export function ItemDetailScreen({ item, modifierGroups, location }: ItemDetailScreenProps) {
  const router = useRouter();

  return (
    <MenuItemDrawer
      item={item}
      modifierGroups={modifierGroups}
      locale={location.locale}
      currency={location.currency}
      onClose={() => router.back()}
    />
  );
}
