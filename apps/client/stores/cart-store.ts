'use client';

import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { MenuItem } from '../data/menu';

export type CartModifier = {
  id: string;
  name: string;
  priceCents: number;
};

export type CartItem = {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
  modifiers?: CartModifier[];
  heroImage?: string;
};

export type SplitMode = 'none' | 'equal' | 'per-guest';

interface CartState {
  items: CartItem[];
  tipPercent: number;
  customTipCents?: number;
  splitMode: SplitMode;
  splitGuests: number;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  updateItemQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  setTipPercent: (percent: number) => void;
  setCustomTipCents: (cents?: number) => void;
  setSplitMode: (mode: SplitMode) => void;
  setSplitGuests: (count: number) => void;
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const storage =
  typeof window === 'undefined'
    ? createJSONStorage(() => noopStorage)
    : createJSONStorage(() => window.localStorage);

const findExistingItem = (items: CartItem[], candidate: Omit<CartItem, 'quantity'>) => {
  return items.find((item) => {
    const sameModifiers = JSON.stringify(item.modifiers ?? []) === JSON.stringify(candidate.modifiers ?? []);
    return item.id === candidate.id && sameModifiers;
  });
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      tipPercent: 10,
      customTipCents: undefined,
      splitMode: 'none',
      splitGuests: 2,
      addItem: (item) =>
        set((state) => {
          const existing = findExistingItem(state.items, item);
          if (existing) {
            return {
              ...state,
              items: state.items.map((line) =>
                line === existing ? { ...line, quantity: line.quantity + 1 } : line
              ),
            };
          }
          return {
            ...state,
            items: [
              ...state.items,
              {
                ...item,
                quantity: 1,
              },
            ],
          };
        }),
      updateItemQuantity: (id, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((line) => line.id !== id)
              : state.items.map((line) => (line.id === id ? { ...line, quantity } : line)),
        })),
      clearCart: () =>
        set({
          items: [],
          customTipCents: undefined,
          tipPercent: 10,
          splitMode: 'none',
          splitGuests: 2,
        }),
      setTipPercent: (percent) => set({ tipPercent: percent, customTipCents: undefined }),
      setCustomTipCents: (cents) => set({ customTipCents: cents, tipPercent: cents === undefined ? 10 : 0 }),
      setSplitMode: (mode) => set({ splitMode: mode }),
      setSplitGuests: (count) => set({ splitGuests: Math.max(1, count) }),
    }),
    {
      name: 'icupa-client-cart',
      storage,
      partialize: (state) => ({
        items: state.items,
        tipPercent: state.tipPercent,
        customTipCents: state.customTipCents,
        splitMode: state.splitMode,
        splitGuests: state.splitGuests,
      }),
    }
  )
);

export const selectCartItems = (state: CartState) => state.items;

export const selectCartTotals = (state: CartState) => {
  const subtotalCents = state.items.reduce((sum, item) => {
    const modifierTotal = item.modifiers?.reduce((acc, modifier) => acc + modifier.priceCents, 0) ?? 0;
    return sum + (item.priceCents + modifierTotal) * item.quantity;
  }, 0);

  const tipCents =
    state.customTipCents !== undefined
      ? state.customTipCents
      : Math.round(subtotalCents * (state.tipPercent / 100));

  return {
    subtotalCents,
    tipCents,
    totalCents: subtotalCents + tipCents,
    tipPercent: state.tipPercent,
    customTipCents: state.customTipCents,
  };
};

export const mapMenuItemToCart = (item: MenuItem): Omit<CartItem, 'quantity'> => ({
  id: item.id,
  name: item.name,
  priceCents: item.priceCents,
  heroImage: item.heroImage,
});
