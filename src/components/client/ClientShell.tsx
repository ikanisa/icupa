import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ActionDock } from "./ActionDock";
import { MenuGrid } from "./MenuGrid";
import { Cart } from "./Cart";
import { PaymentScreen } from "./PaymentScreen";
import { AIChatScreen } from "./AIChatScreen";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  modifiers?: Array<{ name: string; price: number }>;
}

export function ClientShell() {
  const [activeTab, setActiveTab] = useState("menu");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const addToCart = (item: any) => {
    setCartItems(prev => {
      const existing = prev.find(cartItem => cartItem.id === item.id);
      if (existing) {
        return prev.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prev, { 
        id: item.id, 
        name: item.name, 
        price: item.price, 
        quantity: 1 
      }];
    });
  };

  const updateCartItem = (id: string, quantity: number) => {
    if (quantity === 0) {
      setCartItems(prev => prev.filter(item => item.id !== id));
    } else {
      setCartItems(prev =>
        prev.map(item =>
          item.id === id ? { ...item, quantity } : item
        )
      );
    }
  };

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const renderHeader = () => {
    const titles = {
      menu: "Menu",
      cart: "Your Cart",
      pay: "Payment",
      icupa: "Ask ICUPA"
    };

    return (
      <motion.header 
        className="sticky top-0 z-40 glass-card border-0 m-4 mb-0 rounded-2xl p-4"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="flex items-center justify-between">
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
            <h1 className="text-xl font-semibold">{titles[activeTab as keyof typeof titles]}</h1>
          </div>
          
          {activeTab === "menu" && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="rounded-xl">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
        
        {activeTab === "menu" && (
          <div className="mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/50 border-border/50 rounded-xl"
              />
            </div>
          </div>
        )}
      </motion.header>
    );
  };

  const renderContent = () => {
    const pageVariants = {
      hidden: { opacity: 0, x: 20 },
      visible: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -20 }
    };

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={pageVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.2 }}
          className="flex-1"
        >
          {activeTab === "menu" && (
            <MenuGrid 
              items={[]} 
              onItemSelect={(item) => console.log("Item selected:", item)}
              onAddToCart={addToCart}
            />
          )}
          {activeTab === "cart" && (
            <Cart 
              items={cartItems}
              onUpdateItem={updateCartItem}
              onCheckout={() => setActiveTab("pay")}
            />
          )}
          {activeTab === "pay" && (
            <PaymentScreen 
              cartItems={cartItems}
              onPaymentComplete={() => {
                setCartItems([]);
                setActiveTab("menu");
              }}
            />
          )}
          {activeTab === "icupa" && (
            <AIChatScreen />
          )}
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div className="min-h-screen bg-aurora relative overflow-hidden">
      {/* Aurora floating elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="aurora-float absolute top-20 left-10 w-32 h-32 bg-aurora-primary/20 rounded-full blur-xl" />
        <div className="aurora-float absolute top-40 right-20 w-24 h-24 bg-aurora-secondary/20 rounded-full blur-xl" style={{ animationDelay: "2s" }} />
        <div className="aurora-float absolute bottom-40 left-1/3 w-20 h-20 bg-aurora-accent/20 rounded-full blur-xl" style={{ animationDelay: "4s" }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {renderHeader()}
        {renderContent()}
        <ActionDock 
          activeTab={activeTab}
          onTabChange={setActiveTab}
          cartItemCount={totalItems}
        />
      </div>
    </div>
  );
}