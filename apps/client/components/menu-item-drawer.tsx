'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, Button, Badge } from '@icupa/ui';
import { Check, Clock, Flame, Leaf } from 'lucide-react';
import type { MenuItem, MenuModifierGroup } from '../data/menu';
import { centsToCurrency, formatMinutes } from '../lib/format';
import { useCartStore } from '../stores/cart-store';

interface MenuItemDrawerProps {
  item: MenuItem | null;
  modifierGroups: MenuModifierGroup[];
  locale: string;
  currency: 'RWF' | 'EUR';
  onClose: () => void;
}

export function MenuItemDrawer({ item, modifierGroups, locale, currency, onClose }: MenuItemDrawerProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});

  const totalPriceCents = useMemo(() => {
    if (!item) {
      return 0;
    }
    const modifierTotal = Object.entries(selectedModifiers).reduce((total, [groupId, modifierIds]) => {
      const group = modifierGroups.find((candidate) => candidate.id === groupId);
      if (!group) {
        return total;
      }
      const groupTotal = modifierIds.reduce((sum, modifierId) => {
        const modifier = group.modifiers.find((option) => option.id === modifierId);
        return modifier ? sum + modifier.priceCents : sum;
      }, 0);
      return total + groupTotal;
    }, 0);
    return item.priceCents + modifierTotal;
  }, [item, modifierGroups, selectedModifiers]);

  const toggleModifier = (groupId: string, modifierId: string) => {
    const group = modifierGroups.find((candidate) => candidate.id === groupId);
    if (!group) {
      return;
    }
    setSelectedModifiers((current) => {
      const next = new Set(current[groupId] ?? []);
      if (next.has(modifierId)) {
        next.delete(modifierId);
      } else {
        if (group.max && next.size >= group.max) {
          return current;
        }
        next.add(modifierId);
      }
      return { ...current, [groupId]: Array.from(next) };
    });
  };

  useEffect(() => {
    setSelectedModifiers({});
  }, [item?.id]);

  const handleAdd = () => {
    if (!item) {
      return;
    }
    const modifiers = Object.entries(selectedModifiers).flatMap(([groupId, modifierIds]) => {
      const group = modifierGroups.find((candidate) => candidate.id === groupId);
      if (!group) {
        return [];
      }
      return modifierIds
        .map((modifierId) => group.modifiers.find((modifier) => modifier.id === modifierId))
        .filter((modifier): modifier is NonNullable<typeof modifier> => Boolean(modifier))
        .map((modifier) => ({
          id: modifier.id,
          name: modifier.name,
          priceCents: modifier.priceCents,
        }));
    });

    addItem({
      id: item.id,
      name: item.name,
      priceCents: item.priceCents,
      modifiers,
      heroImage: item.heroImage,
    });
    onClose();
  };

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="glass-surface max-h-[85vh] overflow-y-auto border border-white/15 bg-gradient-to-b from-[#170b33]/95 to-[#080611]/95 text-white">
        {item ? (
          <div className="space-y-8">
            <SheetHeader className="text-left">
              <SheetTitle className="text-3xl font-semibold">{item.name}</SheetTitle>
              <SheetDescription className="text-white/70">{item.description}</SheetDescription>
            </SheetHeader>

            <div className="flex flex-wrap gap-3 text-sm text-white/80">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" aria-hidden /> {formatMinutes(item.preparationMinutes)}
              </span>
              {item.spiceLevel ? (
                <span className="flex items-center gap-1">
                  <Flame className="h-4 w-4" aria-hidden /> {item.spiceLevel}
                </span>
              ) : null}
              {item.dietaryTags.includes('vegan') ? (
                <span className="flex items-center gap-1">
                  <Leaf className="h-4 w-4" aria-hidden /> Vegan
                </span>
              ) : null}
            </div>

            {modifierGroups.length > 0 ? (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Make it yours</h3>
                {modifierGroups.map((group) => (
                  <div key={group.id} className="space-y-3 rounded-2xl border border-white/15 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-medium">{group.name}</span>
                      {group.min || group.max ? (
                        <Badge variant="outline" className="border-white/15 text-xs uppercase tracking-wide text-white/70">
                          {group.min ? `Min ${group.min}` : null}
                          {group.min && group.max ? ' · ' : null}
                          {group.max ? `Max ${group.max}` : null}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.modifiers.map((modifier) => {
                        const selected = Boolean(selectedModifiers[group.id]?.includes(modifier.id));
                        return (
                          <Button
                            key={modifier.id}
                            type="button"
                            variant={selected ? 'default' : 'outline'}
                            onClick={() => toggleModifier(group.id, modifier.id)}
                            className={selected ? 'bg-white text-slate-900 hover:bg-white/90' : 'border-white/20 text-white hover:bg-white/10'}
                          >
                            <Check className="mr-2 h-4 w-4" aria-hidden />
                            {modifier.name}
                            {modifier.priceCents > 0 ? ` · ${centsToCurrency(modifier.priceCents, locale, currency)}` : null}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 rounded-2xl border border-white/15 bg-white/10 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm uppercase tracking-wide text-white/70">Total</span>
                <span className="text-2xl font-semibold text-gradient">{centsToCurrency(totalPriceCents, locale, currency)}</span>
              </div>
              <Button onClick={handleAdd} className="glass-surface bg-white/10 text-white hover:bg-white/20">
                Add to cart
              </Button>
              <Button variant="ghost" className="text-white/70 hover:text-white" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
