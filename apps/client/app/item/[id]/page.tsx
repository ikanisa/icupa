import { notFound } from 'next/navigation';
import { menuItems, menuLocations, menuModifierGroups } from '../../../data/menu';
import { ItemDetailScreen } from '../../../components/item-detail-screen';

interface ItemPageProps {
  params: { id: string };
}

export default function ItemPage({ params }: ItemPageProps) {
  const item = menuItems.find((candidate) => candidate.id === params.id);
  const location = menuLocations[0];

  if (!item) {
    notFound();
  }

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-12">
      <ItemDetailScreen item={item} modifierGroups={menuModifierGroups[item.id] ?? []} location={location} />
    </main>
  );
}
