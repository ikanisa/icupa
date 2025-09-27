import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent } from "@icupa/ui/card";
import { Badge } from "@icupa/ui/badge";
import { Button } from "@icupa/ui/button";
import { Plus, Clock, Star, Leaf, Flame, Wine } from "lucide-react";
import type { MenuItem } from "@/data/menu";
import { formatCurrency } from "@/lib/currency";

interface MenuGridProps {
  items: MenuItem[];
  currency: "EUR" | "RWF";
  locale: string;
  onItemSelect: (item: MenuItem) => void;
  onAddToCart: (item: MenuItem) => void;
}

export function MenuGrid({ items, currency, locale, onItemSelect, onAddToCart }: MenuGridProps) {
  const prefersReducedMotion = useReducedMotion();
  const container = prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        show: { opacity: 1 },
      }
    : {
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            staggerChildren: 0.08,
          },
        },
      };

  const item = prefersReducedMotion
    ? { hidden: { opacity: 0 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="w-24 h-24 mx-auto rounded-2xl bg-muted/20 flex items-center justify-center">
            <Leaf className="w-10 h-10 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">No dishes match your filters</h3>
            <p className="text-sm text-muted-foreground">
              Adjust dietary preferences or allergen exclusions to see more of the menu.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 pb-32"
    >
      {items.map((menuItem) => {
        const formattedPrice = formatCurrency(menuItem.priceCents, currency, locale);
        const showAlcoholBadge = menuItem.containsAlcohol || menuItem.dietaryTags.includes("contains-alcohol");
        const isSpicy = menuItem.dietaryTags.includes("spicy") || menuItem.spiceLevel === "hot";

        return (
          <motion.div key={menuItem.id} variants={item}>
            <Card
              className="glass-card border-0 overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => onItemSelect(menuItem)}
              role="button"
              tabIndex={0}
            >
              <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 relative">
                {!menuItem.isAvailable && (
                  <div className="absolute inset-0 bg-muted/80 flex items-center justify-center">
                    <Badge variant="secondary">Unavailable</Badge>
                  </div>
                )}
                <div className="absolute top-2 left-2 flex flex-wrap gap-2">
                  {isSpicy && (
                    <Badge variant="secondary" className="bg-warning/30 text-warning-foreground">
                      <Flame className="w-3 h-3 mr-1" />
                      Spicy
                    </Badge>
                  )}
                  {showAlcoholBadge && (
                    <Badge variant="secondary" className="bg-primary/20 text-primary">
                      <Wine className="w-3 h-3 mr-1" />
                      Contains alcohol
                    </Badge>
                  )}
                  {menuItem.highlight && (
                    <Badge variant="outline" className="bg-background/80 text-xs">
                      {menuItem.highlight}
                    </Badge>
                  )}
                </div>
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary" className="bg-background/80">
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    {menuItem.rating.toFixed(1)}
                  </Badge>
                </div>
              </div>

              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="font-semibold text-lg leading-tight">{menuItem.name}</h3>
                    <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
                      {menuItem.description}
                    </p>
                  </div>
                  <span className="text-lg font-bold text-primary whitespace-nowrap">{formattedPrice}</span>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {menuItem.preparationMinutes} min prep
                  </div>
                  {menuItem.dietaryTags.includes("vegan") && (
                    <div className="flex items-center gap-1 text-success">
                      <Leaf className="w-3 h-3" />
                      Vegan
                    </div>
                  )}
                  {menuItem.dietaryTags.includes("vegetarian") && !menuItem.dietaryTags.includes("vegan") && (
                    <div className="flex items-center gap-1 text-success">
                      <Leaf className="w-3 h-3" />
                      Vegetarian
                    </div>
                  )}
                </div>

                {menuItem.allergens.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {menuItem.allergens.map((allergen) => (
                      <Badge key={allergen} variant="outline" className="text-xs capitalize">
                        {allergen.replace("-", " ")}
                      </Badge>
                    ))}
                  </div>
                )}

                <Button
                  className="w-full"
                  disabled={!menuItem.isAvailable}
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddToCart(menuItem);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add to cart
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
