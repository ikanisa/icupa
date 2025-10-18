'use client';

import { useMemo } from 'react';
import { ShoppingCart, Sparkles, Wallet } from 'lucide-react';
import { Button } from '@icupa/ui';
import { useRouter } from 'next/navigation';
import { useCartStore, selectCartItems, selectCartTotals } from '../stores/cart-store';
import { centsToCurrency } from '../lib/format';

interface ActionDockProps {
  locale: string;
  currency: 'RWF' | 'EUR';
}

export function ActionDock({ locale, currency }: ActionDockProps) {
  const router = useRouter();
  const items = useCartStore(selectCartItems);
  const totals = useCartStore(selectCartTotals);
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  if (items.length === 0) {
    return (
      <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 shadow-aurora backdrop-blur-lg">
        <span className="text-sm text-white/70">Add dishes to unlock quick actions</span>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 shadow-aurora backdrop-blur-lg">
      <Button
        variant="ghost"
        className="flex items-center gap-2 text-white hover:text-white"
        onClick={() => router.push('/ai')}
      >
        <Sparkles className="h-4 w-4" aria-hidden /> AI Waiter
      </Button>
      <Button
        variant="outline"
        className="glass-surface border-white/20 text-white hover:bg-white/10"
        onClick={() => router.push('/cart')}
      >
        <ShoppingCart className="mr-2 h-4 w-4" aria-hidden />
        {itemCount} items · {centsToCurrency(totals.subtotalCents, locale, currency)}
      </Button>
      <Button className="glass-surface bg-white/15 text-white hover:bg-white/25" onClick={() => router.push('/pay')}>
        <Wallet className="mr-2 h-4 w-4" aria-hidden />
        {centsToCurrency(totals.totalCents, locale, currency)}
      </Button>
    </div>
  );
}
