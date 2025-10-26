import { beforeEach, describe, expect, it, vi } from "vitest";

type PersistedCartSnapshot = {
  state?: {
    items?: Array<{ id: string; quantity: number }>;
  };
};

type MockStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  key: (index: number) => string | null;
  length: number;
};

function createMockStorage(initial?: Map<string, string>): MockStorage {
  const store = initial ?? new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe("cart-store offline persistence", () => {
  const CART_KEY = "icupa-cart";

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("persists cart mutations into localStorage", async () => {
    const storage = createMockStorage();
    const mockWindow = {
      localStorage: storage,
      matchMedia: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
      navigator: { userAgent: "vitest" },
    } as unknown as Window;

    vi.stubGlobal("window", mockWindow);

    const { useCartStore } = await import("./cart-store");

    useCartStore.getState().addItem({
      id: "amarula-cheesecake",
      name: "Amarula Cheesecake",
      priceCents: 7800,
      modifiers: [],
    });

    expect(storage.getItem(CART_KEY)).toBeTruthy();
    const parsed = JSON.parse(storage.getItem(CART_KEY) ?? "{}") as PersistedCartSnapshot;
    const items = parsed.state?.items ?? [];
    expect(Array.isArray(items)).toBe(true);
    expect(items[0]?.quantity).toBe(1);
  });

  it("rehydrates the cart from storage after a reload", async () => {
    const snapshotStore = new Map<string, string>();
    const firstStorage = createMockStorage(snapshotStore);
    const firstWindow = {
      localStorage: firstStorage,
      matchMedia: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
      navigator: { userAgent: "vitest" },
    } as unknown as Window;
    vi.stubGlobal("window", firstWindow);

    const { useCartStore: initialStore } = await import("./cart-store");
    initialStore.getState().addItem({
      id: "isombe-croquettes",
      name: "Isombe Croquettes",
      priceCents: 6200,
      modifiers: [],
    });

    const persisted = snapshotStore.get(CART_KEY);
    expect(persisted).toBeTruthy();

    vi.resetModules();
    vi.unstubAllGlobals();

    const secondStorage = createMockStorage(
      persisted ? new Map<string, string>([[CART_KEY, persisted]]) : undefined,
    );
    const secondWindow = {
      localStorage: secondStorage,
      matchMedia: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
      navigator: { userAgent: "vitest" },
    } as unknown as Window;
    vi.stubGlobal("window", secondWindow);

    const { useCartStore: rehydratedStore } = await import("./cart-store");
    expect(rehydratedStore.getState().items).toHaveLength(1);
    expect(rehydratedStore.getState().items[0]?.id).toBe("isombe-croquettes");
  });

  it("clears persisted state when the cart is reset", async () => {
    const storage = createMockStorage();
    const mockWindow = {
      localStorage: storage,
      matchMedia: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
      navigator: { userAgent: "vitest" },
    } as unknown as Window;
    vi.stubGlobal("window", mockWindow);

    const { useCartStore } = await import("./cart-store");
    useCartStore.getState().addItem({
      id: "espresso",
      name: "Single Origin Espresso",
      priceCents: 2500,
      modifiers: [],
    });
    expect(storage.getItem(CART_KEY)).toBeTruthy();

    useCartStore.getState().clearCart();
    const persisted = storage.getItem(CART_KEY);
    expect(persisted).toBeTruthy();
    const parsed = JSON.parse(persisted ?? "{}") as Record<string, unknown>;
    const items = (parsed.state as { items?: unknown[] } | undefined)?.items ?? [];
    expect(Array.isArray(items)).toBe(true);
    expect(items).toHaveLength(0);
  });
});
