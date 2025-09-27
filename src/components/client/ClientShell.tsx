import { useEffect, useMemo, useState } from "react";
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
  Timer,
  Sparkles,
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
import { useSemanticMenuSearch } from "@/hooks/useSemanticMenuSearch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatRemainingDuration } from "@/lib/table-session";

const SESSION_WARNING_THRESHOLD_MS = 10 * 60 * 1000;

function isExpiringSoon(remainingMs: number | null): boolean {
  if (remainingMs === null) {
    return false;
  }
  return remainingMs > 0 && remainingMs <= SESSION_WARNING_THRESHOLD_MS;
}

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
  const {
    session: tableSession,
    status: tableSessionStatus,
    timeRemainingMs: tableSessionRemainingMs,
  } = useTableSession();
  const backgroundSyncOptions = useMemo(
    () => ({
      tableSessionId: tableSession?.id ?? null,
      locationId: tableSession?.locationId ?? (selectedLocationId ? selectedLocationId : null),
    }),
    [selectedLocationId, tableSession?.id, tableSession?.locationId],
  );
  useBackgroundSyncToast(backgroundSyncOptions);
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
  const addItemToCart = useCartStore((state) => state.addItem);
  const updateCartQuantity = useCartStore((state) => state.updateItemQuantity);
  const clearCart = useCartStore((state) => state.clearCart);
  const setTipPercent = useCartStore((state) => state.setTipPercent);
  const setCustomTipCents = useCartStore((state) => state.setCustomTipCents);
  const tipPercent = useCartStore((state) => state.tipPercent);
  const customTipCents = useCartStore((state) => state.customTipCents);
  const splitMode = useCartStore((state) => state.splitMode);
  const splitGuests = useCartStore((state) => state.splitGuests);
  const setSplitMode = useCartStore((state) => state.setSplitMode);
  const setSplitGuests = useCartStore((state) => state.setSplitGuests);

  const agentCartItems = useMemo(
    () => cartItems.map((item) => ({ id: item.id, quantity: item.quantity })),
    [cartItems]
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

  const pushSubscription = usePushSubscription({
    tableSessionId: tableSession?.id ?? null,
    locationId: tableSession?.locationId ?? selectedLocation?.id ?? null,
    tenantId: null,
  });

  const shouldShowPushCard =
    pushSubscription.canSubscribe &&
    !pushSubscription.isSubscribed &&
    pushSubscription.permission !== "unsupported";

  const pushButtonDisabled =
    pushSubscription.permission === "denied" || pushSubscription.isSubscribing;

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

  const baseFilteredItems = useMemo(() => {
    return locationItems
      .filter((item) => (activeCategory === "all" ? true : item.categoryId === activeCategory))
      .filter((item) => (filters.availableOnly ? item.isAvailable : true))
      .filter((item) =>
        filters.maxPrepMinutes ? item.preparationMinutes <= filters.maxPrepMinutes : true,
      )
      .filter((item) =>
        filters.excludedAllergens.length === 0
          ? true
          : !item.allergens.some((allergen) => filters.excludedAllergens.includes(allergen)),
      )
      .filter((item) =>
        filters.dietaryTags.length === 0
          ? true
          : filters.dietaryTags.every((tag) => item.dietaryTags.includes(tag)),
      );
  }, [activeCategory, filters, locationItems]);

  const trimmedSearch = searchQuery.trim();
  const normalizedSearch = trimmedSearch.toLowerCase();
  const searchLength = trimmedSearch.length;

  const {
    matches: semanticMatches,
    scores: semanticScores,
    isFetching: isSemanticFetching,
    isError: isSemanticError,
    error: semanticError,
    attempted: semanticAttempted,
    usedSemantic,
  } = useSemanticMenuSearch({
    query: trimmedSearch,
    items: baseFilteredItems,
    locationId: selectedLocationId || null,
    tableSessionId: tableSession?.id ?? null,
    enabled: menuSource === "supabase" && tableSessionStatus === "ready",
  });

  const semanticErrorMessage = semanticError?.message ?? null;
  const semanticMatchScores = usedSemantic ? semanticScores : undefined;
  const shouldShowSemanticStatus =
    searchLength >= 3 &&
    (isSemanticFetching || semanticAttempted || isSemanticError || usedSemantic);

  const filteredItems = useMemo(() => {
    if (searchLength === 0) {
      return baseFilteredItems;
    }

    if (usedSemantic && semanticMatches.length > 0) {
      const seen = new Set(semanticMatches.map((item) => item.id));
      const remainder = baseFilteredItems.filter((item) => !seen.has(item.id));
      return [...semanticMatches, ...remainder];
    }

    if (searchLength >= 2) {
      const fuse = new Fuse(baseFilteredItems, {
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

    if (searchLength === 1) {
      return baseFilteredItems.filter((item) =>
        [item.name, item.description, ...(item.recommendedPairings ?? [])]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch),
      );
    }

    return baseFilteredItems;
  }, [baseFilteredItems, normalizedSearch, searchLength, semanticMatches, usedSemantic]);

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

  const tableSessionRemainingLabel = useMemo(
    () => formatRemainingDuration(tableSessionRemainingMs),
    [tableSessionRemainingMs]
  );

  const tableSessionExpiringSoon = useMemo(
    () => isExpiringSoon(tableSessionRemainingMs),
    [tableSessionRemainingMs]
  );

  const shouldShowSessionAlerts =
    (tableSessionStatus === "ready" && tableSessionExpiringSoon) || tableSessionStatus === "error";

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
                <Badge
                  variant="secondary"
                  className={`gap-1 ${
                    tableSessionExpiringSoon
                      ? "bg-amber-500/20 text-amber-50"
                      : "bg-emerald-500/10 text-emerald-100"
                  }`}
                >
                  {tableSessionExpiringSoon ? (
                    <Timer className="h-3 w-3" />
                  ) : (
                    <ShieldCheck className="h-3 w-3" />
                  )}
                  {tableSessionExpiringSoon
                    ? `Session ends in ${tableSessionRemainingLabel ?? "soon"}`
                    : `Table linked${
                        tableSessionRemainingLabel ? ` • ${tableSessionRemainingLabel} left` : ""
                      }`}
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

              {shouldShowSemanticStatus && (
                <div
                  className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                  role="status"
                  aria-live="polite"
                >
                  {isSemanticFetching && (
                    <Badge
                      variant="outline"
                      className="gap-1 rounded-full bg-background/60 border-border/40 px-3 py-1"
                    >
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Searching menu…
                    </Badge>
                  )}
                  {!isSemanticFetching && usedSemantic && (
                    <Badge
                      variant="secondary"
                      className="gap-1 rounded-full bg-primary/15 text-primary border-primary/20 px-3 py-1"
                    >
                      <Sparkles className="h-3 w-3" />
                      AI-ranked dishes
                    </Badge>
                  )}
                  {!isSemanticFetching && semanticAttempted && !usedSemantic && !isSemanticError && (
                    <span>Showing closest dishes from the menu.</span>
                  )}
                  {isSemanticError && (
                    <span
                      className="flex items-center gap-1 text-amber-200"
                      title={semanticErrorMessage ?? undefined}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Search is offline — using local results
                    </span>
                  )}
                </div>
              )}

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

        {shouldShowSessionAlerts && (
          <div className="px-4 pt-4 space-y-3">
            {tableSessionStatus === "ready" && tableSessionExpiringSoon && (
            <Alert className="glass-card border-0 bg-amber-500/10 text-amber-50">
              <Timer className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>Session ending soon</AlertTitle>
              <AlertDescription>
                Rescan the table QR within {tableSessionRemainingLabel ?? "the next few minutes"} to continue ordering.
              </AlertDescription>
            </Alert>
            )}

            {tableSessionStatus === "error" && (
              <Alert className="glass-card border-0" variant="destructive">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>We couldn&apos;t link your table</AlertTitle>
                <AlertDescription>
                  Please scan the QR code again or ask a team member to refresh your session so new orders stay with your table.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <main id="main-content" className="flex-1 flex flex-col focus:outline-none" tabIndex={-1} role="main">
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
                    onClick={() => setDismissInstallBanner(true)}
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
                    <p className="text-sm font-semibold">Enable instant updates</p>
                    <p className="text-xs text-muted-foreground">
                      Get notified when receipts are issued or an order status changes, even if you close the app.
                    </p>
                  </div>
                  {pushSubscription.shouldShowIosInstallHint && (
                    <p className="text-xs text-muted-foreground">
                      Install ICUPA from Safari (Share → <strong>Add to Home Screen</strong>) before enabling push alerts on iOS.
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
                </div>
                <Button
                  onClick={() => pushSubscription.subscribe()}
                  disabled={pushButtonDisabled}
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                >
                  {pushSubscription.isSubscribing ? "Enabling…" : "Enable alerts"}
                </Button>
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
                  matchScores={semanticMatchScores}
                />
              )}
              {activeTab === "cart" && (
                <Cart
                  items={cartItems}
                  currency={selectedLocation.currency}
                  locale={selectedLocation.locale}
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
                  tableSessionId={tableSession?.id ?? null}
                  locationId={selectedLocation?.id ?? null}
                  menuSource={menuSource}
                  cartItems={agentCartItems}
                  allergies={filters.excludedAllergens}
                  language={selectedLocation?.locale ?? (typeof navigator !== "undefined" ? navigator.language : "en")}
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
