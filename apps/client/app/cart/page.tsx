'use client';

import Link from 'next/link';
import { Button } from '@icupa/ui';
import { CartSummary } from '../../components/cart-summary';
import { TipSelector } from '../../components/tip-selector';
import { menuLocations } from '../../data/menu';
import { useCartStore, selectCartItems } from '../../stores/cart-store';

export default function CartPage() {
  const location = menuLocations[0];
  const items = useCartStore(selectCartItems);
  const hasItems = items.length > 0;
  const guestCount = useCartStore((state) => state.splitGuests);
  const splitMode = useCartStore((state) => state.splitMode);
  const setSplitMode = useCartStore((state) => state.setSplitMode);
  const setSplitGuests = useCartStore((state) => state.setSplitGuests);

  return (
    <main className="flex-1 px-6 py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <header className="space-y-2 text-white">
          <h1 className="text-4xl font-semibold">Your cart</h1>
          <p className="text-base text-white/70">Review your selections and configure splitting or tipping before checkout.</p>
        </header>

        <CartSummary locale={location.locale} currency={location.currency} />

        {hasItems ? (
          <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
            <header>
              <h3 className="text-lg font-semibold">Split the bill</h3>
              <p className="text-sm text-white/70">Everyone can scan the QR and pay their share from any device.</p>
            </header>
            <div className="flex flex-wrap gap-3">
              {(
                [
                  { id: 'none', label: 'Single payer' },
                  { id: 'equal', label: 'Split evenly' },
                  { id: 'per-guest', label: 'Per guest' },
                ] as const
              ).map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  variant={splitMode === option.id ? 'default' : 'outline'}
                  onClick={() => setSplitMode(option.id)}
                  className={splitMode === option.id ? 'bg-white text-slate-900 hover:bg-white/90' : 'border-white/20 text-white hover:bg-white/10'}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            {splitMode !== 'none' ? (
              <div className="flex items-center gap-3">
                <label htmlFor="guest-count" className="text-sm text-white/70">
                  Guests
                </label>
                <input
                  id="guest-count"
                  type="number"
                  min={1}
                  value={guestCount}
                  onChange={(event) => setSplitGuests(Number.parseInt(event.target.value, 10) || 1)}
                  className="h-10 w-24 rounded-xl border border-white/20 bg-transparent px-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                />
              </div>
            ) : null}
          </section>
        ) : null}

        {hasItems ? <TipSelector /> : null}

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" className="glass-surface border-white/20 text-white hover:bg-white/10">
            <Link href="/">Continue browsing</Link>
          </Button>
          <Button asChild className="glass-surface bg-white/15 text-white hover:bg-white/20" disabled={!hasItems}>
            <Link href="/pay">Continue to payment</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
