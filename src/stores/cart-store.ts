import { create, type StateCreator } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { createSafeStateStorage } from "@/lib/safe-storage";
import { createSelectors } from "@/lib/zustand-selectors";

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
    : createJSONStorage(() => createSafeStateStorage(window.localStorage));

const CART_DEFAULTS: Pick<
  CartState,
  "items" | "tipPercent" | "customTipCents" | "splitMode" | "splitGuests"
> = {
  items: [],
  tipPercent: 10,
  customTipCents: undefined,
  splitMode: "none",
  splitGuests: 2,
};

const cartCreator: StateCreator<CartState, [["zustand/persist", unknown], ["zustand/immer", never]], []> = (
  set,
) => ({
  ...CART_DEFAULTS,
  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((line) => line.id === item.id);
      if (existing) {
        existing.quantity += 1;
        return;
      }
      state.items.push({ ...item, quantity: 1 });
    }),
  incrementItem: (id) =>
    set((state) => {
      const line = state.items.find((item) => item.id === id);
      if (line) {
        line.quantity += 1;
      }
    }),
  updateItemQuantity: (id, quantity) =>
    set((state) => {
      const index = state.items.findIndex((item) => item.id === id);
      if (index === -1) {
        return;
      }
      if (quantity <= 0) {
        state.items.splice(index, 1);
        return;
      }
      state.items[index]!.quantity = quantity;
    }),
  clearCart: () =>
    set((state) => {
      state.items = [];
      state.tipPercent = CART_DEFAULTS.tipPercent;
      state.customTipCents = CART_DEFAULTS.customTipCents;
      state.splitMode = CART_DEFAULTS.splitMode;
      state.splitGuests = CART_DEFAULTS.splitGuests;
    }),
  setTipPercent: (percent) =>
    set((state) => {
      state.tipPercent = percent;
      state.customTipCents = undefined;
    }),
  setCustomTipCents: (cents) =>
    set((state) => {
      state.customTipCents = cents;
      state.tipPercent = cents === undefined ? CART_DEFAULTS.tipPercent : 0;
    }),
  setSplitMode: (mode) =>
    set((state) => {
      state.splitMode = mode;
      if (mode === "none") {
        state.splitGuests = CART_DEFAULTS.splitGuests;
      }
    }),
  setSplitGuests: (count) =>
    set((state) => {
      state.splitGuests = Math.max(1, count);
    }),
});

const cartStore = create<CartState>()(
  persist(
    immer(cartCreator),
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

export const useCartStore = createSelectors(cartStore);

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
