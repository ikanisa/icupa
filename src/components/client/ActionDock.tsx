import { motion, useReducedMotion } from "framer-motion";
import { Menu, ShoppingCart, CreditCard, Bot } from "lucide-react";
import { Button } from "@icupa/ui/button";
import { cn } from "@/lib/utils";

interface ActionDockProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  cartItemCount?: number;
}

const dockItems = [
  { id: "menu", label: "Menu", icon: Menu },
  { id: "cart", label: "Cart", icon: ShoppingCart },
  { id: "pay", label: "Pay", icon: CreditCard },
  { id: "icupa", label: "Ask ICUPA", icon: Bot },
];

export function ActionDock({ activeTab, onTabChange, cartItemCount = 0 }: ActionDockProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.nav
      initial={prefersReducedMotion ? undefined : { y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50 thumb-reach"
      role="navigation"
      aria-label="Primary diner actions"
    >
      <div className="mx-4 mb-4">
        <div className="glass-card rounded-2xl p-2">
          <div className="flex items-center justify-around">
            {dockItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;

              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="lg"
                  className={cn(
                    "flex-1 flex-col gap-1 h-auto py-3 relative transition-all duration-200",
                    isActive
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={
                    item.id === "cart" && cartItemCount > 0
                      ? `${item.label} (${cartItemCount} item${cartItemCount === 1 ? "" : "s"})`
                      : undefined
                  }
                  data-testid={`dock-tab-${item.id}`}
                >
                  <div className="relative">
                    <Icon size={20} />
                    {item.id === "cart" && cartItemCount > 0 && (
                      <motion.div
                        initial={prefersReducedMotion ? undefined : { scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium"
                      >
                        {cartItemCount > 99 ? "99+" : cartItemCount}
                      </motion.div>
                    )}
                  </div>
                  <span className="text-xs font-medium">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-primary/10 rounded-xl"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
