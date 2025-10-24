import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, Trash2, ShoppingBag, WifiOff } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCurrency } from "@/lib/currency";
import type { CartItem, SplitMode } from "@/stores/cart-store";

interface CartProps {
  items: CartItem[];
  currency: "EUR" | "RWF";
  locale: string;
  taxRate: number;
  tipPercent: number;
  customTipCents?: number;
  splitMode: SplitMode;
  splitGuests: number;
  onUpdateItem: (id: string, quantity: number) => void;
  onTipPercentChange: (percent: number) => void;
  onCustomTipChange: (cents?: number) => void;
  onSplitModeChange: (mode: SplitMode) => void;
  onSplitGuestsChange: (count: number) => void;
  onCheckout: () => void;
  isOffline?: boolean;
}

const QUICK_TIP_PERCENTAGES = [0, 5, 10, 12, 15];

export function Cart({
  items,
  currency,
  locale,
  taxRate,
  tipPercent,
  customTipCents,
  splitMode,
  splitGuests,
  onUpdateItem,
  onTipPercentChange,
  onCustomTipChange,
  onSplitModeChange,
  onSplitGuestsChange,
  onCheckout,
  isOffline = false,
}: CartProps) {
  const prefersReducedMotion = useReducedMotion();
  const [splitPlannerOpen, setSplitPlannerOpen] = useState(false);

  const { subtotalCents, normalizedTaxRate, taxCents, tipCents, totalCents } = useMemo(() => {
    const subtotal = items.reduce((sum, item) => {
      const modifierTotal = item.modifiers?.reduce(
        (modSum, mod) => modSum + mod.priceCents,
        0
      ) ?? 0;
      return sum + (item.priceCents + modifierTotal) * item.quantity;
    }, 0);

    const normalizedTaxRate = Number.isFinite(taxRate) ? Math.max(0, Math.min(taxRate, 1)) : 0;
    const tax = Math.round(subtotal * normalizedTaxRate);
    const computedTip =
      customTipCents !== undefined
        ? customTipCents
        : Math.round(subtotal * (tipPercent / 100));

    return {
      subtotalCents: subtotal,
      normalizedTaxRate,
      taxCents: tax,
      tipCents: computedTip,
      totalCents: subtotal + tax + computedTip,
    };
  }, [items, customTipCents, tipPercent, taxRate]);

  const equalShare = useMemo(() => {
    if (splitMode !== "equal" || splitGuests <= 0) return undefined;
    return Math.ceil(totalCents / splitGuests);
  }, [splitMode, splitGuests, totalCents]);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-24 h-24 mx-auto mb-6 bg-muted/20 rounded-2xl flex items-center justify-center">
            <ShoppingBag className="w-12 h-12 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Your cart is empty</h3>
          <p className="text-muted-foreground mb-6">
            Add some delicious items from our menu to get started.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 pb-32">
      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-4 flex-1"
      >
        {items.map((item, index) => {
          const modifierTotal = item.modifiers?.reduce(
            (modSum, mod) => modSum + mod.priceCents,
            0
          ) ?? 0;
          const lineTotal = (item.priceCents + modifierTotal) * item.quantity;

          return (
            <motion.div
              key={item.id}
              initial={prefersReducedMotion ? undefined : { opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : index * 0.08 }}
            >
              <Card className="glass-card border-0">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(item.priceCents, currency, locale)} each
                      </p>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {item.modifiers.map((modifier, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {modifier.name}
                              {modifier.priceCents > 0
                                ? ` (+${formatCurrency(modifier.priceCents, currency, locale)})`
                                : ""}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onUpdateItem(item.id, 0)}
                      className="text-destructive hover:text-destructive"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdateItem(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="w-8 h-8 p-0 rounded-full"
                        aria-label={`Decrease ${item.name}`}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdateItem(item.id, item.quantity + 1)}
                        className="w-8 h-8 p-0 rounded-full"
                        aria-label={`Increase ${item.name}`}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(lineTotal, currency, locale)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: prefersReducedMotion ? 0 : 0.1 }}
        className="mt-6 space-y-4"
      >
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="text-base">Tip your team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {QUICK_TIP_PERCENTAGES.map((percentage) => {
                const isActive =
                  customTipCents === undefined && tipPercent === percentage;
                return (
                  <Button
                    key={percentage}
                    variant={isActive ? "default" : "secondary"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => onTipPercentChange(percentage)}
                  >
                    {percentage}%
                  </Button>
                );
              })}
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="custom-tip"
                className="text-xs uppercase tracking-wide text-muted-foreground"
              >
                Custom tip amount
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="custom-tip"
                  type="number"
                  min={0}
                  step="0.5"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="bg-background/60 border-border/40"
                  value={
                    customTipCents !== undefined
                      ? (customTipCents / 100).toFixed(2)
                      : ""
                  }
                  onChange={(event) => {
                    const value = Number.parseFloat(event.target.value);
                    if (Number.isNaN(value)) {
                      onCustomTipChange(undefined);
                      return;
                    }
                    onCustomTipChange(Math.round(value * 100));
                  }}
                />
                <span className="text-sm text-muted-foreground">{currency}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCustomTipChange(undefined)}
                  className="rounded-full"
                >
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="text-base">Split the bill</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <span>
                {splitMode === "none"
                  ? "Everyone pays together"
                  : splitMode === "equal"
                  ? `Split equally between ${splitGuests} guest${
                      splitGuests > 1 ? "s" : ""
                    }`
                  : "Assign dishes per guest (coming soon)"}
              </span>
              {equalShare && (
                <Badge variant="outline" className="w-fit text-xs">
                  Each guest: {formatCurrency(equalShare, currency, locale)}
                </Badge>
              )}
            </div>
            <Sheet open={splitPlannerOpen} onOpenChange={setSplitPlannerOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary" className="rounded-full">
                  Configure split
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-3xl">
                <SheetHeader>
                  <SheetTitle>Split options</SheetTitle>
                  <SheetDescription>
                    Decide how you’d like to divide the check. We’ll keep totals transparent for everyone at the table.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  <section className="space-y-3">
                    <Label className="text-sm font-medium">Method</Label>
                    <RadioGroup
                      value={splitMode}
                      onValueChange={(value) => onSplitModeChange(value as SplitMode)}
                      className="grid grid-cols-1 gap-3"
                    >
                      <div className="flex items-start gap-3 rounded-2xl border border-border/40 p-3">
                        <RadioGroupItem value="none" id="split-none" />
                        <Label htmlFor="split-none" className="text-sm leading-tight">
                          <span className="font-medium">One payment</span>
                          <p className="text-xs text-muted-foreground">
                            Settle everything on a single device.
                          </p>
                        </Label>
                      </div>
                      <div className="flex items-start gap-3 rounded-2xl border border-border/40 p-3">
                        <RadioGroupItem value="equal" id="split-equal" />
                        <Label htmlFor="split-equal" className="text-sm leading-tight">
                          <span className="font-medium">Split equally</span>
                          <p className="text-xs text-muted-foreground">
                            We’ll divide the total including tip and tax across guests.
                          </p>
                        </Label>
                      </div>
                      <div className="flex items-start gap-3 rounded-2xl border border-border/40 p-3 opacity-70">
                        <RadioGroupItem value="per-guest" id="split-per-guest" />
                        <Label htmlFor="split-per-guest" className="text-sm leading-tight">
                          <span className="font-medium">Assign per guest</span>
                          <p className="text-xs text-muted-foreground">
                            Coming soon: move dishes between diners right from the cart.
                          </p>
                        </Label>
                      </div>
                    </RadioGroup>
                  </section>

                  {splitMode === "equal" && (
                    <section className="space-y-3">
                      <Label htmlFor="split-guests" className="text-sm font-medium">
                        Number of guests
                      </Label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-full"
                          onClick={() => onSplitGuestsChange(Math.max(1, splitGuests - 1))}
                          aria-label="Remove guest"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          id="split-guests"
                          type="number"
                          min={1}
                          value={splitGuests}
                          onChange={(event) =>
                            onSplitGuestsChange(Number.parseInt(event.target.value, 10) || 1)
                          }
                          className="text-center"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-full"
                          onClick={() => onSplitGuestsChange(splitGuests + 1)}
                          aria-label="Add guest"
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </section>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </CardContent>
        </Card>

        <Card className="glass-card border-0">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-lg font-semibold">Order summary</h3>

            {isOffline && (
              <div
                className="rounded-2xl border border-warning/40 bg-warning/10 text-warning-foreground text-sm p-3 flex gap-3"
                role="status"
                aria-live="polite"
              >
                <div className="mt-0.5">
                  <WifiOff className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-medium">You’re offline</p>
                  <p className="text-xs">
                    We’ll keep your cart safe. Reconnect to complete payment and sync with the kitchen.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotalCents, currency, locale)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax ({Math.round(normalizedTaxRate * 100)}%)</span>
                <span>{formatCurrency(taxCents, currency, locale)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tip {customTipCents === undefined ? `(${tipPercent}%)` : "(custom)"}</span>
                <span>{formatCurrency(tipCents, currency, locale)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-semibold text-base">
                <span>Total</span>
                <span>{formatCurrency(totalCents, currency, locale)}</span>
              </div>
            </div>

            <Button
              className="w-full mt-4 bg-primary-gradient hover:opacity-90 transition-opacity"
              size="lg"
              onClick={onCheckout}
              disabled={isOffline}
              aria-disabled={isOffline}
            >
              {isOffline ? "Reconnect to continue" : "Proceed to payment"}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
