import { AnimatePresence, motion } from "framer-motion";
import { MenuGrid } from "../MenuGrid";
import { Cart } from "../Cart";
import { PaymentScreen } from "../PaymentScreen";
import { AIChatScreen } from "../AIChatScreen";
import { ActionDock } from "../ActionDock";
import type { MenuItem } from "@/data/menu";
import type { MenuLocation } from "@/data/menu";
import type { SplitMode } from "@/stores/cart-store";

interface CartItem {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
}

interface ClientJourneyContentProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  filteredItems: MenuItem[];
  selectedLocation: MenuLocation;
  cartItems: CartItem[];
  tipPercent: number;
  customTipCents: number | null;
  splitMode: SplitMode;
  splitGuests: number;
  onUpdateItemQuantity: (id: string, quantity: number) => void;
  onTipPercentChange: (value: number) => void;
  onCustomTipChange: (value: number | null) => void;
  onSplitModeChange: (mode: SplitMode) => void;
  onSplitGuestsChange: (value: number) => void;
  addItemToCart: (item: { id: string; name: string; priceCents: number }) => void;
  onSelectItem: (item: MenuItem) => void;
  clearCart: () => void;
  tableSessionId: string | null | undefined;
  tenantId: string;
  locale: string;
  allergies: string[];
  ageGateChoice: "unknown" | "verified" | "declined";
  isOnline: boolean;
  prefersReducedMotion: boolean;
}

export function ClientJourneyContent({
  activeTab,
  onTabChange,
  filteredItems,
  selectedLocation,
  cartItems,
  tipPercent,
  customTipCents,
  splitMode,
  splitGuests,
  onUpdateItemQuantity,
  onTipPercentChange,
  onCustomTipChange,
  onSplitModeChange,
  onSplitGuestsChange,
  addItemToCart,
  onSelectItem,
  clearCart,
  tableSessionId,
  tenantId,
  locale,
  allergies,
  ageGateChoice,
  isOnline,
  prefersReducedMotion,
}: ClientJourneyContentProps) {
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

  const cartSummary = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
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
              onItemSelect={onSelectItem}
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
              onUpdateItem={onUpdateItemQuantity}
              onTipPercentChange={onTipPercentChange}
              onCustomTipChange={onCustomTipChange}
              onSplitModeChange={onSplitModeChange}
              onSplitGuestsChange={onSplitGuestsChange}
              onCheckout={() => onTabChange("pay")}
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
                onTabChange("menu");
              }}
              isOffline={!isOnline}
            />
          )}
          {activeTab === "icupa" && (
            <AIChatScreen
              tableSessionId={tableSessionId}
              tenantId={tenantId}
              locationId={selectedLocation.id}
              locale={locale}
              allergies={allergies}
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

      <ActionDock activeTab={activeTab} onTabChange={onTabChange} cartItemCount={cartSummary} />
    </>
  );
}
