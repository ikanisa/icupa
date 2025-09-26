import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Clock, Star, Leaf } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  allergens: string[];
  dietary: string[];
  preparationTime: number;
  rating: number;
  isAvailable: boolean;
}

interface MenuGridProps {
  items: MenuItem[];
  onItemSelect: (item: MenuItem) => void;
  onAddToCart: (item: MenuItem) => void;
}

const mockItems: MenuItem[] = [
  {
    id: "1",
    name: "Truffle Risotto",
    description: "Creamy arborio rice with wild mushrooms and black truffle shavings",
    price: 24.50,
    allergens: ["dairy", "gluten"],
    dietary: ["vegetarian"],
    preparationTime: 25,
    rating: 4.8,
    isAvailable: true,
  },
  {
    id: "2", 
    name: "Grilled Salmon",
    description: "Atlantic salmon with seasonal vegetables and lemon herb butter",
    price: 28.00,
    allergens: ["fish", "dairy"],
    dietary: [],
    preparationTime: 20,
    rating: 4.6,
    isAvailable: true,
  },
  {
    id: "3",
    name: "Plant-Based Burger",
    description: "House-made patty with avocado, arugula, and cashew mayo",
    price: 18.50,
    allergens: ["nuts", "gluten"],
    dietary: ["vegan", "plant-based"],
    preparationTime: 15,
    rating: 4.4,
    isAvailable: false,
  },
];

export function MenuGrid({ items = mockItems, onItemSelect, onAddToCart }: MenuGridProps) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 pb-32"
    >
      {items.map((menuItem) => (
        <motion.div key={menuItem.id} variants={item}>
          <Card 
            className="glass-card border-0 overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform duration-200"
            onClick={() => onItemSelect(menuItem)}
          >
            <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 relative">
              {!menuItem.isAvailable && (
                <div className="absolute inset-0 bg-muted/80 flex items-center justify-center">
                  <Badge variant="secondary">Unavailable</Badge>
                </div>
              )}
              <div className="absolute top-2 right-2">
                <Badge variant="secondary" className="bg-background/80">
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  {menuItem.rating}
                </Badge>
              </div>
            </div>
            
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-lg">{menuItem.name}</h3>
                <span className="text-lg font-bold text-primary">
                  ${menuItem.price.toFixed(2)}
                </span>
              </div>
              
              <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                {menuItem.description}
              </p>
              
              <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {menuItem.preparationTime}min
                </div>
                {menuItem.dietary.includes("vegan") && (
                  <div className="flex items-center gap-1 text-success">
                    <Leaf className="w-3 h-3" />
                    Vegan
                  </div>
                )}
              </div>
              
              {menuItem.allergens.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {menuItem.allergens.map((allergen) => (
                    <Badge key={allergen} variant="outline" className="text-xs capitalize">
                      {allergen}
                    </Badge>
                  ))}
                </div>
              )}
              
              <Button 
                className="w-full" 
                disabled={!menuItem.isAvailable}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart(menuItem);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add to Cart
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}