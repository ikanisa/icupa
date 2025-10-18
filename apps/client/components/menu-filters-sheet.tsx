'use client';

import { useMemo } from 'react';
import { Button, Checkbox, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, Switch } from '@icupa/ui';
import { allergenOptions, dietaryTags } from '../data/menu';

export interface MenuFilters {
  excludedAllergens: string[];
  dietaryTags: string[];
  availableOnly: boolean;
  maxPrepMinutes?: number;
}

interface MenuFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: MenuFilters;
  onChange: (filters: MenuFilters) => void;
}

export function MenuFiltersSheet({ open, onOpenChange, filters, onChange }: MenuFiltersSheetProps) {
  const allergenLookup = useMemo(() => new Set(filters.excludedAllergens), [filters.excludedAllergens]);
  const dietaryLookup = useMemo(() => new Set(filters.dietaryTags), [filters.dietaryTags]);

  const toggleAllergen = (code: string) => {
    const next = new Set(allergenLookup);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    onChange({ ...filters, excludedAllergens: Array.from(next) });
  };

  const toggleDietary = (tag: string) => {
    const next = new Set(dietaryLookup);
    if (next.has(tag)) {
      next.delete(tag);
    } else {
      next.add(tag);
    }
    onChange({ ...filters, dietaryTags: Array.from(next) });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <span className="sr-only">Toggle menu filters</span>
      </SheetTrigger>
      <SheetContent side="right" className="w-full min-[480px]:w-[420px] bg-gradient-to-b from-[#160b33] to-[#0c0a18] text-white">
        <SheetHeader>
          <SheetTitle className="text-left text-2xl font-semibold">Refine menu</SheetTitle>
        </SheetHeader>
        <div className="mt-8 space-y-8">
          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Show only available</h3>
              <Switch
                checked={filters.availableOnly}
                onCheckedChange={(checked) => onChange({ ...filters, availableOnly: checked })}
                aria-label="Show only currently available items"
              />
            </div>
          </section>

          <section>
            <h3 className="text-lg font-medium">Avoid allergens</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {allergenOptions.map((option) => (
                <label
                  key={option.code}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <Checkbox
                    checked={allergenLookup.has(option.code)}
                    onCheckedChange={() => toggleAllergen(option.code)}
                    aria-label={`Avoid ${option.label}`}
                  />
                  <span className="text-sm text-white/80">{option.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-medium">Dietary tags</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {dietaryTags.map((tag) => (
                <Button
                  key={tag}
                  type="button"
                  variant={dietaryLookup.has(tag) ? 'default' : 'outline'}
                  onClick={() => toggleDietary(tag)}
                  className={dietaryLookup.has(tag) ? 'bg-white/90 text-slate-900 hover:bg-white' : 'border-white/20 text-white hover:bg-white/10'}
                >
                  {tag.replace('-', ' ')}
                </Button>
              ))}
            </div>
          </section>

          <Button
            type="button"
            variant="ghost"
            className="text-sm text-white/60 underline-offset-4 hover:text-white hover:underline"
            onClick={() =>
              onChange({
                excludedAllergens: [],
                dietaryTags: [],
                availableOnly: true,
                maxPrepMinutes: undefined,
              })
            }
          >
            Reset filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
