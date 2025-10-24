import { functionDescriptors } from "@ecotrips/api";
import { CheckoutInput, InventorySearchInput } from "@ecotrips/types";
import { create } from "zustand";
import { z } from "zod";

export type SearchOutput = z.infer<
  NonNullable<(typeof functionDescriptors)["inventory.search"]["output"]>
>;
export type QuoteOutput = z.infer<
  NonNullable<(typeof functionDescriptors)["inventory.quote"]["output"]>
>;
export type CheckoutOutput = z.infer<
  NonNullable<(typeof functionDescriptors)["checkout.intent"]["output"]>
>;

type AppStore = {
  searchInput: InventorySearchInput | null;
  searchResults: SearchOutput | null;
  setSearchInput: (input: InventorySearchInput) => void;
  setSearchResults: (results: SearchOutput | null) => void;
  itineraryQuote: QuoteOutput | null;
  setItineraryQuote: (quote: QuoteOutput | null) => void;
  checkoutLastInput: CheckoutInput | null;
  checkoutResult: CheckoutOutput | null;
  setCheckoutLastInput: (input: CheckoutInput | null) => void;
  setCheckoutResult: (result: CheckoutOutput | null) => void;
  resetCheckout: () => void;
};

export const useAppStore = create<AppStore>((set) => ({
  searchInput: null,
  searchResults: null,
  setSearchInput: (input) => set({ searchInput: input }),
  setSearchResults: (results) => set({ searchResults: results }),
  itineraryQuote: null,
  setItineraryQuote: (quote) => set({ itineraryQuote: quote }),
  checkoutLastInput: null,
  checkoutResult: null,
  setCheckoutLastInput: (input) => set({ checkoutLastInput: input }),
  setCheckoutResult: (result) => set({ checkoutResult: result }),
  resetCheckout: () => set({ checkoutLastInput: null, checkoutResult: null }),
}));
