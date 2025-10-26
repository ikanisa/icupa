import { useCallback, useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ActionDock } from "./ActionDock";
import { MenuGrid } from "./MenuGrid";
import { Cart } from "./Cart";
import { PaymentScreen } from "./PaymentScreen";
import { AIChatScreen } from "./AIChatScreen";
import { SkipNavLink } from "./SkipNavLink";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Search,
  Filter,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  WifiOff,
  CloudOff,
  RotateCw,
  Bell,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { allergenOptions, dietaryTags, type MenuCategory, type MenuItem } from "@/data/menu";
import { MenuFiltersSheet, type MenuFilters } from "./MenuFiltersSheet";
import { MenuItemDrawer } from "./MenuItemDrawer";
import { useTableSession } from "@/hooks/useTableSession";
import { useCartStore, selectCartItems } from "@/stores/cart-store";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useMenuData } from "@/hooks/useMenuData";
import { useReceiptNotifications } from "@/hooks/useReceiptNotifications";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { useBackgroundSyncToast } from "@/hooks/useBackgroundSyncToast";
import { emitClientEvent } from "@/lib/client-events";

const DEFAULT_FILTERS: MenuFilters = {
  excludedAllergens: [],
  dietaryTags: [],
  availableOnly: true,
  maxPrepMinutes: undefined,
};

export function ClientShell() {
  const [activeTab, setActiveTab] = useState("menu");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [filters, setFilters] = useState<MenuFilters>(DEFAULT_FILTERS);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [ageGateChoice, setAgeGateChoice] = useState<"unknown" | "verified" | "declined">("unknown");
  const [hasLoadedAgeGate, setHasLoadedAgeGate] = useState(false);
  const { session: tableSession, status: tableSessionStatus } = useTableSession();
  useReceiptNotifications({
    tableSessionId: tableSession?.id ?? null,
    enabled: tableSessionStatus === "ready",
  });
  const prefersReducedMotion = useReducedMotion();
  const { promptInstall, status: installStatus } = useInstallPrompt();
  const [dismissInstallBanner, setDismissInstallBanner] = useState(false);
  const { isOnline, lastChanged } = useNetworkStatus();
  const {
    locations,
    categories,
    items,
    source: menuSource,
    isError: menuError,
    isFetching: isMenuFetching,
    refetch: refetchMenu,
  } = useMenuData();

  const cartItems = useCartStore(selectCartItems);
  const addItemToCart = useCartStore.use.addItem();
  const updateCartQuantity = useCartStore.use.updateItemQuantity();
  const clearCart = useCartStore.use.clearCart();
  const setTipPercent = useCartStore.use.setTipPercent();
  const setCustomTipCents = useCartStore.use.setCustomTipCents();
  const tipPercent = useCartStore.use.tipPercent();
  const customTipCents = useCartStore.use.customTipCents();
  const splitMode = useCartStore.use.splitMode();
  const splitGuests = useCartStore.use.splitGuests();
  const setSplitMode = useCartStore.use.setSplitMode();
  const setSplitGuests = useCartStore.use.setSplitGuests();

  const reportStorageFailure = useCallback((operation: "get" | "set" | "remove", key: string, error: unknown) => {
    emitClientEvent({
      type: "storage_error",
      payload: {
        storage: "localStorage",
        operation,
        key,
        message: error instanceof Error ? error.message : String(error ?? "unknown error"),
        quotaExceeded: error instanceof DOMException && error.name === "QuotaExceededError",
      },
    });
  }, []);

  const readFromStorage = useCallback(
    (key: string): string | null => {
      if (typeof window === "undefined") {
        return null;
      }
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        reportStorageFailure("get", key, error);
        return null;
      }
    },
    [reportStorageFailure]
  );

  const persistToStorage = useCallback(
    (key: string, value: string) => {
      if (typeof window === "undefined") {
        return;
      }
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        reportStorageFailure("set", key, error);
      }
    },
    [reportStorageFailure]
  );

  useEffect(() => {
    if (menuSource === "loading") {
      return;
    }
    if (locations.length === 0) {
      return;
    }
    setSelectedLocationId((current) => {
      if (!current) {
        return locations[0].id;
      }
      const exists = locations.some((location) => location.id === current);
      return exists ? current : locations[0].id;
    });
  }, [locations, menuSource]);

  useEffect(() => {
    if (!tableSession?.locationId) {
      return;
    }
    if (menuSource !== "supabase") {
      return;
    }
    setSelectedLocationId(tableSession.locationId);
  }, [menuSource, tableSession?.locationId]);

  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === selectedLocationId) ?? locations[0],
    [locations, selectedLocationId]
  );

  useBackgroundSyncToast({
    tenantId: selectedLocation?.tenantId ?? null,
    locationId: selectedLocation?.id ?? null,
    tableSessionId: tableSession?.id ?? null,
  });

  const pushSubscription = usePushSubscription({
    tableSessionId: tableSession?.id ?? null,
    locationId: tableSession?.locationId ?? selectedLocation?.id ?? null,
    tenantId: null,
  });

  const requiredAge = selectedLocation?.region === "EU" ? 17 : 18;
  const shouldShowAgeDialog = hasLoadedAgeGate && ageGateChoice === "unknown";

  const handleAgeConfirm = () => {
    setAgeGateChoice("verified");
    persistToStorage("icupa_age_gate_choice", "verified");
  };

  const handleAgeDecline = () => {
    setAgeGateChoice("declined");
    persistToStorage("icupa_age_gate_choice", "declined");
  };

  const handleInstallDismiss = () => {
    setDismissInstallBanner(true);
    persistToStorage("icupa_install_banner_dismissed", "true");
  };

  useEffect(() => {
    const stored = readFromStorage("icupa_age_gate_choice");
    if (stored === "verified" || stored === "declined") {
      setAgeGateChoice(stored);
    }
    setHasLoadedAgeGate(true);
  }, [readFromStorage]);

  useEffect(() => {
    const stored = readFromStorage("icupa_install_banner_dismissed");
    if (stored === "true") {
      setDismissInstallBanner(true);
    }
  }, [readFromStorage]);

  useEffect(() => {
    if (!installStatus.isStandalone) {
      return;
    }
    setDismissInstallBanner(true);
    persistToStorage("icupa_install_banner_dismissed", "true");
  }, [installStatus.isStandalone, persistToStorage]);

  const shouldShowPushCard =
    pushSubscription.canSubscribe && pushSubscription.permission !== "unsupported";

  const pushButtonDisabled =
    pushSubscription.permission === "denied" || pushSubscription.isSubscribing;

  const verifyButtonDisabled = pushSubscription.isVerifying;
  const disableButtonDisabled = pushSubscription.isUnsubscribing;

  useEffect(() => {
    clearCart();
    setActiveTab("menu");
    setActiveCategory("all");
  }, [selectedLocationId, clearCart]);

  const locationItems = useMemo(
    () =>
      items.filter((item) =>
        selectedLocationId ? item.locationIds.includes(selectedLocationId) : true
      ),
    [items, selectedLocationId]
  );

  const locationCategories = useMemo(() => {
    if (!selectedLocationId) {
      return [] as MenuCategory[];
    }
    const relevantCategoryIds = new Set(locationItems.map((item) => item.categoryId));
    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const derived: MenuCategory[] = [];
    relevantCategoryIds.forEach((categoryId) => {
      const matched = categoryMap.get(categoryId);
      if (matched) {
        derived.push(matched);
      } else {
        derived.push({ id: categoryId, name: categoryId, description: "" });
      }
    });
    return derived.sort((a, b) => {
      const orderA = a.sortOrder ?? Number.POSITIVE_INFINITY;
      const orderB = b.sortOrder ?? Number.POSITIVE_INFINITY;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name);
    });
  }, [categories, locationItems, selectedLocationId]);

  useEffect(() => {
    if (activeCategory === "all") {
      return;
    }
    if (!locationCategories.some((category) => category.id === activeCategory)) {
      setActiveCategory("all");
    }
  }, [activeCategory, locationCategories]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const base = locationItems
      .filter((item) => (activeCategory === "all" ? true : item.categoryId === activeCategory))
      .filter((item) => (filters.availableOnly ? item.isAvailable : true))
      .filter((item) => (ageGateChoice === "declined" ? !item.containsAlcohol : true))
      .filter((item) =>
        filters.maxPrepMinutes ? item.preparationMinutes <= filters.maxPrepMinutes : true
      )
      .filter((item) =>
        filters.excludedAllergens.length === 0
          ? true
          : !item.allergens.some((allergen) => filters.excludedAllergens.includes(allergen))
      )
      .filter((item) =>
        filters.dietaryTags.length === 0
          ? true
          : filters.dietaryTags.every((tag) => item.dietaryTags.includes(tag))
      );

    if (normalizedSearch.length >= 2) {
      const fuse = new Fuse(base, {
        keys: [
          { name: "name", weight: 0.45 },
          { name: "description", weight: 0.3 },
          { name: "dietaryTags", weight: 0.15 },
          { name: "recommendedPairings", weight: 0.1 },
        ],
        threshold: 0.38,
        includeScore: true,
      });

      return fuse.search(normalizedSearch).map((result) => result.item);
    }

    if (normalizedSearch.length === 1) {
      return base.filter((item) =>
        [item.name, item.description, ...(item.recommendedPairings ?? [])]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      );
    }

    return base;
  }, [activeCategory, filters, locationItems, searchQuery, ageGateChoice]);

  const totalItems = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const activeFilterCount =
    filters.excludedAllergens.length +
    filters.dietaryTags.length +
    (filters.availableOnly ? 0 : 1) +
    (filters.maxPrepMinutes ? 1 : 0);

  const pageVariants = prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        hidden: { opacity: 0, x: 20 },
        visible: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
      };

  const shouldShowInstallBanner =
    !dismissInstallBanner &&
    ((installStatus.installAvailable && !installStatus.isStandalone) ||
      (installStatus.isIos && !installStatus.isStandalone));

  const offlineSinceLabel = useMemo(() => {
    if (!lastChanged) return "";
    return lastChanged.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [lastChanged]);

  if (menuSource === "loading" || !selectedLocation) {
    return (
      <div className="min-h-screen bg-aurora flex items-center justify-center">
        <div className="glass-card rounded-3xl px-8 py-10 text-center space-y-4">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" aria-hidden="true" />
          <div>
            <h1 className="text-lg font-semibold">Fetching the live menu</h1>
            <p className="text-sm text-muted-foreground">
              Hang tight while we load the latest dishes for your table.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-aurora relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="aurora-float absolute top-20 left-10 w-32 h-32 bg-aurora-primary/20 rounded-full blur-xl" />
        <div className="aurora-float absolute top-40 right-20 w-24 h-24 bg-aurora-secondary/20 rounded-full blur-xl" style={{ animationDelay: "2s" }} />
        <div className="aurora-float absolute bottom-40 left-1/3 w-20 h-20 bg-aurora-accent/20 rounded-full blur-xl" style={{ animationDelay: "4s" }} />
      </div>

      <Dialog
        open={shouldShowAgeDialog}
        onOpenChange={(open) => {
          if (!open && ageGateChoice === "unknown") {
            handleAgeDecline();
          }
        }}
      >
        <DialogContent className="glass-card w-full max-w-md border border-white/20 bg-background/90 text-center shadow-xl sm:rounded-3xl [&>button[data-radix-dialog-close]]:hidden">
          <DialogHeader>
            <DialogTitle>Confirm your legal drinking age</DialogTitle>
            <DialogDescription>
              Local regulations require guests in this venue to be at least {requiredAge}+ to view or order alcoholic beverages.
              Confirm your age to see the full menu, or continue with the non-alcoholic experience.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleAgeConfirm} className="flex-1">
              I am {requiredAge}+ and understand the policy
            </Button>
            <Button variant="outline" onClick={handleAgeDecline} className="flex-1">
              Show non-alcoholic options
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="relative z-10 flex flex-col min-h-screen">
        <SkipNavLink />
        <motion.header
          className="sticky top-0 z-40 glass-card border-0 m-4 mb-0 rounded-2xl p-4"
          initial={prefersReducedMotion ? undefined : { y: -100 }}
          animate={prefersReducedMotion ? undefined : { y: 0 }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {activeTab !== "menu" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab("menu")}
                  className="rounded-xl"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              )}
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Dining at</span>
                <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                  <SelectTrigger className="w-[200px] bg-background/50 border-border/50 rounded-xl text-left">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isMenuFetching && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Updating
                </Badge>
              )}
              {tableSessionStatus === "linking" && (
                <Badge variant="secondary" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Linking table…
                </Badge>
              )}
              {tableSessionStatus === "ready" && tableSession && (
                <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-100">
                  <ShieldCheck className="h-3 w-3" />
                  Table linked
                </Badge>
              )}
              {tableSessionStatus === "error" && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Session issue
                </Badge>
              )}
              {menuSource === "static" && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <CloudOff className="w-3 h-3" /> Offline menu
                </Badge>
              )}
              {activeTab === "menu" && (
                <MenuFiltersSheet
                  filters={filters}
                  onChange={setFilters}
                  allergenOptions={allergenOptions}
                  dietaryOptions={dietaryTags}
                  trigger={
                    <Button variant="ghost" size="sm" className="rounded-xl relative">
                      <Filter className="w-4 h-4" />
                      {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="absolute -top-2 -right-2 rounded-full px-1 text-[10px]">
                          {activeFilterCount}
                        </Badge>
                      )}
                    </Button>
                  }
                />
              )}
            </div>
          </div>

          {activeTab === "menu" && (
            <div className="mt-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search dishes, ingredients, or pairings"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background/50 border-border/50 rounded-xl"
                />
              </div>

              <ScrollArea className="pb-1">
                <div className="flex items-center gap-2">
                  <Button
                    variant={activeCategory === "all" ? "default" : "secondary"}
                    size="sm"
                    className="rounded-full px-4"
                    onClick={() => setActiveCategory("all")}
                  >
                    All dishes
                  </Button>
                  {locationCategories.map((category) => (
                    <Button
                      key={category.id}
                      variant={activeCategory === category.id ? "default" : "secondary"}
                      size="sm"
                      className="rounded-full px-4"
                      onClick={() => setActiveCategory(category.id)}
                    >
                      {category.name}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </motion.header>

        <main id="main-content" className="flex-1 flex flex-col focus:outline-none" tabIndex={-1} role="main">
          {ageGateChoice === "declined" && (
            <motion.div
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-4 mt-3"
            >
              <div className="glass-card rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4" role="status">
                <p className="text-sm font-semibold text-amber-100">Serving non-alcoholic experience</p>
                <p className="text-xs text-amber-100/80">
                  Alcoholic items are hidden until a manager verifies the table. Ask staff if you need assistance.
                </p>
              </div>
            </motion.div>
          )}

          {shouldShowInstallBanner && (
            <motion.div
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-4 mt-3"
            >
              <div className="glass-card rounded-2xl border border-border/40 p-4 flex flex-col gap-3" role="status">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Install ICUPA for quick access</p>
                    {installStatus.installAvailable ? (
                      <p className="text-xs text-muted-foreground">
                        Add the app to your home screen for offline access and faster launches.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        On iOS tap the share icon in Safari, then choose <strong>Add to Home Screen</strong> to enable push
                        updates and offline menu browsing.
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    aria-label="Dismiss install guidance"
                    onClick={handleInstallDismiss}
                  >
                    ×
                  </Button>
                </div>
                {installStatus.installAvailable && (
                  <div className="flex gap-2">
                    <Button onClick={promptInstall} className="flex-1">
                      Install now
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {shouldShowPushCard && (
            <motion.div
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-4 mt-3"
            >
              <div className="glass-card rounded-2xl border border-border/40 p-4" role="status">
                <div className="flex items-start gap-3">
                  <div className="mt-1 rounded-full bg-primary/10 text-primary p-2" aria-hidden="true">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div>
                      <p className="text-sm font-semibold">
                        {pushSubscription.isSubscribed ? "Alerts enabled" : "Enable instant updates"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pushSubscription.isSubscribed
                          ? "Send a test notification or disable alerts if you no longer need realtime updates."
                          : "Get notified when receipts are issued or an order status changes, even if you close the app."}
                      </p>
                    </div>
                    {pushSubscription.shouldShowIosInstallHint && (
                      <p className="text-xs text-muted-foreground">
                        Install ICUPA from Safari (Share → <strong>Add to Home Screen</strong>) before enabling push alerts on
                        iOS.
                      </p>
                    )}
                    {pushSubscription.permission === "denied" && (
                      <p className="text-xs text-warning-foreground">
                        Notifications are blocked in your browser preferences. Re-enable them to receive updates.
                      </p>
                    )}
                    {pushSubscription.error && pushSubscription.permission !== "denied" && (
                      <p className="text-xs text-destructive">{pushSubscription.error}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {!pushSubscription.isSubscribed ? (
                        <Button
                          onClick={() => pushSubscription.subscribe()}
                          disabled={pushButtonDisabled}
                          variant="secondary"
                          size="sm"
                          className="rounded-full"
                        >
                          {pushSubscription.isSubscribing ? "Enabling…" : "Enable alerts"}
                        </Button>
                      ) : (
                        <>
                          <Button
                            onClick={() => pushSubscription.verify()}
                            disabled={verifyButtonDisabled}
                            variant="secondary"
                            size="sm"
                            className="rounded-full"
                          >
                            {pushSubscription.isVerifying ? "Sending test…" : "Send test alert"}
                          </Button>
                          <Button
                            onClick={() => pushSubscription.unsubscribe()}
                            disabled={disableButtonDisabled}
                            variant="ghost"
                            size="sm"
                            className="rounded-full"
                          >
                            {pushSubscription.isUnsubscribing ? "Disabling…" : "Disable alerts"}
                          </Button>
                        </>
                      )}
                    </div>
                    {pushSubscription.verificationStatus === "delivered" && (
                      <p className="text-xs text-success">
                        Test notification queued. Check your device to confirm push alerts are working.
                      </p>
                    )}
                    {pushSubscription.verificationStatus === "error" && !pushSubscription.error && (
                      <p className="text-xs text-destructive">
                        We could not send a test notification. Please try again in a moment.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {menuSource === "static" && menuError && (
            <motion.div
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-4 mt-3"
              role="status"
              aria-live="polite"
            >
              <div className="glass-card rounded-2xl border border-warning/40 p-4 flex flex-col gap-3 text-warning-foreground">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Showing cached menu</p>
                    <p className="text-xs opacity-90">
                      We couldn’t reach Supabase just now. You can keep browsing offline and retry when you’re ready.
                    </p>
                  </div>
                </div>
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                    onClick={() => refetchMenu()}
                  >
                    <RotateCw className="w-3 h-3" />
                    Try again
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {!isOnline && (
            <motion.div
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-4 mt-3"
              role="status"
              aria-live="polite"
            >
              <div className="glass-card rounded-2xl border border-warning/40 p-4 flex gap-3 text-warning-foreground">
                <div className="mt-0.5">
                  <WifiOff className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">You’re offline</p>
                  <p className="text-xs opacity-90">
                    Browse the saved menu and update your cart. We’ll sync your table once you’re back online
                    {offlineSinceLabel ? ` (since ${offlineSinceLabel})` : "."}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={pageVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
              className="flex-1"
              role="group"
              aria-label="Diner journey content"
            >
              {activeTab === "menu" && (
                <MenuGrid
                  items={filteredItems}
                  currency={selectedLocation.currency}
                  locale={selectedLocation.locale}
                  onItemSelect={(item) => setSelectedItem(item)}
                  onAddToCart={(item) =>
                    addItemToCart({
                      id: item.id,
                      name: item.name,
                      priceCents: item.priceCents,
                    })
                  }
                />
              )}
              {activeTab === "cart" && (
                <Cart
                  items={cartItems}
                  currency={selectedLocation.currency}
                  locale={selectedLocation.locale}
                  taxRate={selectedLocation.taxRate}
                  tipPercent={tipPercent}
                  customTipCents={customTipCents}
                  splitMode={splitMode}
                  splitGuests={splitGuests}
                  onUpdateItem={updateCartQuantity}
                  onTipPercentChange={setTipPercent}
                  onCustomTipChange={setCustomTipCents}
                  onSplitModeChange={setSplitMode}
                  onSplitGuestsChange={setSplitGuests}
                  onCheckout={() => setActiveTab("pay")}
                  isOffline={!isOnline}
                />
              )}
              {activeTab === "pay" && (
                <PaymentScreen
                  cartItems={cartItems}
                  currency={selectedLocation.currency}
                  locale={selectedLocation.locale}
                  region={selectedLocation.region}
                  taxRate={selectedLocation.taxRate}
                  tipPercent={tipPercent}
                  customTipCents={customTipCents}
                  splitMode={splitMode}
                  splitGuests={splitGuests}
                  onPaymentComplete={() => {
                    clearCart();
                    setActiveTab("menu");
                  }}
                  isOffline={!isOnline}
                />
              )}
              {activeTab === "icupa" && (
                <AIChatScreen
                  tableSessionId={tableSession?.id}
                  tenantId={selectedLocation.tenantId}
                  locationId={selectedLocation.id}
                  locale={selectedLocation.locale}
                  allergies={filters.excludedAllergens}
                  ageVerified={ageGateChoice === "verified"}
                  cartItems={cartItems.map((item) => ({
                    id: item.id,
                    name: item.name,
                    priceCents: item.priceCents,
                    quantity: item.quantity,
                  }))}
                  onAddToCart={({ id, name, priceCents }) =>
                    addItemToCart({
                      id,
                      name,
                      priceCents,
                    })
                  }
                />
              )}
            </motion.div>
          </AnimatePresence>

          <ActionDock activeTab={activeTab} onTabChange={setActiveTab} cartItemCount={totalItems} />
        </main>
      </div>

      <MenuItemDrawer
        item={selectedItem}
        open={selectedItem !== null}
        currency={selectedLocation.currency}
        locale={selectedLocation.locale}
        onClose={() => setSelectedItem(null)}
        onAddToCart={(item) => {
          addItemToCart({
            id: item.id,
            name: item.name,
            priceCents: item.priceCents,
          });
          setSelectedItem(null);
        }}
      />
    </div>
  );
}
