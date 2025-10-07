import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";

export type CartModifier = {
  name: string;
  priceCents: number;
};

export type CartItem = {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
  modifiers?: CartModifier[];
};

export type SplitMode = "none" | "equal" | "per-guest";

interface CartState {
  items: CartItem[];
  tipPercent: number;
  customTipCents?: number;
  splitMode: SplitMode;
  splitGuests: number;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  incrementItem: (id: string) => void;
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
  typeof window === "undefined"
    ? createJSONStorage(() => noopStorage)
    : createJSONStorage(() => window.localStorage);

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      tipPercent: 10,
      customTipCents: undefined,
      splitMode: "none",
      splitGuests: 2,
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((line) => line.id === item.id);
          if (existing) {
            return {
              ...state,
              items: state.items.map((line) =>
                line.id === item.id
                  ? { ...line, quantity: line.quantity + 1 }
                  : line
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
      incrementItem: (id) =>
        set((state) => ({
          items: state.items.map((line) =>
            line.id === id ? { ...line, quantity: line.quantity + 1 } : line
          ),
        })),
      updateItemQuantity: (id, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((line) => line.id !== id)
              : state.items.map((line) =>
                  line.id === id ? { ...line, quantity } : line
                ),
        })),
      clearCart: () =>
        set({
          items: [],
          customTipCents: undefined,
          tipPercent: 10,
          splitMode: "none",
          splitGuests: 2,
        }),
      setTipPercent: (percent) =>
        set({ tipPercent: percent, customTipCents: undefined }),
      setCustomTipCents: (cents) =>
        set({ customTipCents: cents, tipPercent: cents === undefined ? 10 : 0 }),
      setSplitMode: (mode) => set({ splitMode: mode }),
      setSplitGuests: (count) => set({ splitGuests: Math.max(1, count) }),
    }),
    {
      name: "icupa-cart",
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
    const modifierTotal = item.modifiers?.reduce(
      (modSum, mod) => modSum + mod.priceCents,
      0
    );
    return (
      sum +
      (item.priceCents + (modifierTotal ?? 0)) *
        item.quantity
    );
  }, 0);

  const tipCents =
    state.customTipCents !== undefined
      ? state.customTipCents
      : Math.round(subtotalCents * (state.tipPercent / 100));

  return {
    subtotalCents,
    tipCents,
    tipPercent: state.tipPercent,
    customTipCents: state.customTipCents,
  };
};
