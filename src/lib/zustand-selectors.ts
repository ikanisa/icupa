import type { StoreApi, UseBoundStore } from "zustand";

export type StoreWithSelectors<S extends object> = UseBoundStore<StoreApi<S>> & {
  use: { [K in keyof S]: () => S[K] };
};

export function createSelectors<S extends object>(store: UseBoundStore<StoreApi<S>>): StoreWithSelectors<S> {
  const useSelectors = new Proxy(
    {},
    {
      get: (_target, prop: string) => store((state) => state[prop as keyof S]),
    }
  ) as StoreWithSelectors<S>["use"];

  return Object.assign(store, { use: useSelectors });
}

