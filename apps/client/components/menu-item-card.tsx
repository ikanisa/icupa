'use client';

import { Sparkles } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Badge } from '@icupa/ui';
import type { MenuItem } from '../data/menu';
import { centsToCurrency, formatMinutes } from '../lib/format';
import { useCartStore, mapMenuItemToCart } from '../stores/cart-store';

interface MenuItemCardProps {
  item: MenuItem;
  locale: string;
  currency: 'RWF' | 'EUR';
  onSelect: (item: MenuItem) => void;
}

export function MenuItemCard({ item, locale, currency, onSelect }: MenuItemCardProps) {
  const addItem = useCartStore((state) => state.addItem);

  const handleAdd = () => {
    addItem(mapMenuItemToCart(item));
  };

  return (
    <Card className="group relative h-full overflow-hidden border-white/10 bg-white/[0.06] text-white shadow-aurora transition hover:border-white/25">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold">{item.name}</CardTitle>
          {item.highlight ? (
            <Badge variant="outline" className="border-white/30 text-xs uppercase tracking-wide text-white/80">
              <Sparkles className="mr-1 h-3 w-3" aria-hidden />
              {item.highlight}
            </Badge>
          ) : null}
        </div>
        <CardDescription className="line-clamp-2 text-sm text-white/75">{item.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-white/70">
        <p>
          Ready in <span className="font-medium text-white">{formatMinutes(item.preparationMinutes)}</span>
        </p>
        {item.dietaryTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {item.dietaryTags.map((tag) => (
              <Badge key={tag} variant="outline" className="border-white/20 text-xs uppercase tracking-wide text-white/70">
                {tag.replace('-', ' ')}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2 pt-0">
        <span className="text-lg font-semibold text-gradient">{centsToCurrency(item.priceCents, locale, currency)}</span>
        <div className="flex gap-2">
          <Button variant="ghost" className="text-white/80 hover:text-white" onClick={() => onSelect(item)}>
            Details
          </Button>
          <Button onClick={handleAdd} className="glass-surface bg-white/10 text-white hover:bg-white/20">
            Add
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
