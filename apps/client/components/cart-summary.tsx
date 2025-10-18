'use client';

import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle, Input, Label } from '@icupa/ui';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { centsToCurrency } from '../lib/format';
import { useCartStore, selectCartItems, selectCartTotals } from '../stores/cart-store';

interface CartSummaryProps {
  locale: string;
  currency: 'RWF' | 'EUR';
  showClearButton?: boolean;
}

export function CartSummary({ locale, currency, showClearButton = true }: CartSummaryProps) {
  const items = useCartStore(selectCartItems);
  const totals = useCartStore(selectCartTotals);
  const updateQuantity = useCartStore((state) => state.updateItemQuantity);
  const clearCart = useCartStore((state) => state.clearCart);

  if (items.length === 0) {
    return (
      <Card className="glass-surface border-white/10 bg-white/5 text-white">
        <CardHeader>
          <CardTitle className="text-xl">Your cart is empty</CardTitle>
        </CardHeader>
        <CardContent className="text-white/70">
          Add dishes from the menu to start your order. Items remain saved even if you go offline.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-surface border-white/10 bg-white/5 text-white">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl">Your order</CardTitle>
        {showClearButton ? (
          <Button variant="ghost" className="text-white/70 hover:text-white" onClick={() => clearCart()}>
            <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Clear cart
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-medium text-white">{item.name}</p>
                {item.modifiers && item.modifiers.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-white/70">
                    {item.modifiers.map((modifier) => (
                      <li key={modifier.id}>
                        + {modifier.name} ({centsToCurrency(modifier.priceCents, locale, currency)})
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="text-right text-lg font-semibold text-gradient">
                {centsToCurrency(item.priceCents * item.quantity, locale, currency)}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor={`quantity-${item.id}`} className="text-sm text-white/70">
                Quantity
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-white/80 hover:text-white"
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  aria-label={`Decrease ${item.name}`}
                >
                  <Minus className="h-4 w-4" aria-hidden />
                </Button>
                <Input
                  id={`quantity-${item.id}`}
                  value={item.quantity}
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10);
                    if (!Number.isNaN(value)) {
                      updateQuantity(item.id, value);
                    }
                  }}
                  className="h-9 w-14 text-center"
                  inputMode="numeric"
                  aria-label={`Quantity for ${item.name}`}
                />
                <Button
                  size="icon"
                  className="h-8 w-8 glass-surface bg-white/10 text-white hover:bg-white/20"
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  aria-label={`Increase ${item.name}`}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm text-white/70">
          <span>Subtotal</span>
          <span className="text-base font-medium text-white">{centsToCurrency(totals.subtotalCents, locale, currency)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-white/70">
          <span>Tip</span>
          <span className="text-base font-medium text-white">{centsToCurrency(totals.tipCents, locale, currency)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-white/10 pt-3 text-lg font-semibold text-gradient">
          <span>Total due</span>
          <span>{centsToCurrency(totals.totalCents, locale, currency)}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
