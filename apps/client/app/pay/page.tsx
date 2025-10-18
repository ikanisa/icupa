'use client';

import Link from 'next/link';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@icupa/ui';
import { SmartphoneNfc, Wallet2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CartSummary } from '../../components/cart-summary';
import { menuLocations } from '../../data/menu';
import { useCartStore, selectCartTotals } from '../../stores/cart-store';
import { centsToCurrency } from '../../lib/format';

const PAYMENT_METHODS = [
  { id: 'momo', label: 'MoMo / Airtel Money', icon: SmartphoneNfc },
  { id: 'card', label: 'Card (Stripe/Adyen)', icon: Wallet2 },
];

export default function PayPage() {
  const location = menuLocations[0];
  const totals = useCartStore(selectCartTotals);
  const [selectedMethod, setSelectedMethod] = useState(PAYMENT_METHODS[0].id);
  const hasCart = useMemo(() => totals.totalCents > 0, [totals.totalCents]);

  return (
    <main className="flex-1 px-6 py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <header className="space-y-2 text-white">
          <h1 className="text-4xl font-semibold">Settle your table</h1>
          <p className="text-base text-white/70">Payments happen over secure Supabase Edge Functions with session-scoped headers.</p>
        </header>

        <CartSummary locale={location.locale} currency={location.currency} showClearButton={false} />

        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
          <header className="space-y-1">
            <h3 className="text-lg font-semibold">Payment method</h3>
            <p className="text-sm text-white/70">Choose how you would like to pay. We support mobile money and card rails.</p>
          </header>
          <div className="grid gap-3 md:grid-cols-2">
            {PAYMENT_METHODS.map((method) => {
              const Icon = method.icon;
              const isActive = method.id === selectedMethod;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setSelectedMethod(method.id)}
                  className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                    isActive ? 'border-white/80 bg-white/90 text-slate-900' : 'border-white/10 bg-white/5 text-white'
                  }`}
                >
                  <Icon className="h-6 w-6" aria-hidden />
                  <span className="text-base font-medium">{method.label}</span>
                  <span className="text-sm text-white/70">
                    {method.id === 'momo' ? 'Instant confirmation. We notify the kitchen once funds land.' : 'Supports tap-to-pay and stored cards.'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <Card className="glass-surface border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle className="text-xl">Secure hand-off</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-white/70">
            <p>
              We sign requests with your table session header (<code className="rounded bg-black/40 px-1 py-0.5 text-xs">x-icupa-session</code>)
              so Supabase RLS only exposes your table.
            </p>
            <p>Receipts and fiscal numbers are issued instantly after payment.</p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" className="glass-surface border-white/20 text-white hover:bg-white/10">
            <Link href="/cart">Back to cart</Link>
          </Button>
          <Button className="glass-surface bg-white/15 text-white hover:bg-white/20" disabled={!hasCart}>
            Pay {centsToCurrency(totals.totalCents, location.locale, location.currency)} securely
          </Button>
        </div>
      </div>
    </main>
  );
}
