'use client';

import { ChangeEvent } from 'react';
import { Filter, Search } from 'lucide-react';
import { Button, Input } from '@icupa/ui';

interface MenuHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onOpenFilters: () => void;
}

export function MenuHeader({ searchQuery, onSearchChange, onOpenFilters }: MenuHeaderProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value);
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex w-full items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 shadow-aurora">
        <Search className="h-5 w-5 text-white/70" aria-hidden />
        <Input
          value={searchQuery}
          onChange={handleChange}
          placeholder="Search dishes or ingredients"
          className="h-10 border-0 bg-transparent px-0 text-base text-white placeholder:text-white/50 focus-visible:ring-0"
          aria-label="Search menu"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onOpenFilters}
        className="glass-surface border-white/15 text-white hover:bg-white/10"
        aria-label="Open filters"
      >
        <Filter className="mr-2 h-4 w-4" aria-hidden /> Filters
      </Button>
    </div>
  );
}
