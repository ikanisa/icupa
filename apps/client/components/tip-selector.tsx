'use client';

import { Button, Slider } from '@icupa/ui';
import { percentageLabel } from '../lib/format';
import { useCartStore } from '../stores/cart-store';

const suggestedTips = [0, 10, 15, 20];

export function TipSelector() {
  const tipPercent = useCartStore((state) => state.tipPercent);
  const setTipPercent = useCartStore((state) => state.setTipPercent);
  const setCustomTipCents = useCartStore((state) => state.setCustomTipCents);

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
      <header>
        <h3 className="text-lg font-semibold">Appreciate your crew</h3>
        <p className="text-sm text-white/70">Choose a tip or enter a custom amount at payment.</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {suggestedTips.map((value) => (
          <Button
            key={value}
            type="button"
            variant={tipPercent === value ? 'default' : 'outline'}
            onClick={() => {
              setCustomTipCents(undefined);
              setTipPercent(value);
            }}
            className={tipPercent === value ? 'bg-white text-slate-900 hover:bg-white/90' : 'border-white/20 text-white hover:bg-white/10'}
          >
            {percentageLabel(value)}
          </Button>
        ))}
      </div>
      <Slider
        value={[tipPercent]}
        min={0}
        max={30}
        step={1}
        onValueChange={([value]) => {
          setCustomTipCents(undefined);
          setTipPercent(value);
        }}
        aria-label="Tip percentage"
        className="mt-2"
      />
      <p className="text-sm text-white/60">Tips are shared with the service team. Custom tips can be added on the payment screen.</p>
    </section>
  );
}
