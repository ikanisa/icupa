import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/currency";
import type { MenuItem } from "@/data/menu";
import { Clock, Leaf, Flame } from "lucide-react";

interface MenuItemDrawerProps {
  item: MenuItem | null;
  open: boolean;
  currency: "EUR" | "RWF";
  locale: string;
  onClose: () => void;
  onAddToCart: (item: MenuItem) => void;
}

export function MenuItemDrawer({ item, open, currency, locale, onClose, onAddToCart }: MenuItemDrawerProps) {
  if (!item) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(value) => (!value ? onClose() : undefined)}>
      <DialogContent className="max-w-lg w-full rounded-3xl border border-border/40 bg-background/95 backdrop-blur-xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 text-left">
          <DialogTitle className="text-2xl font-semibold leading-tight">{item.name}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {item.description}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="px-6 pb-6 space-y-5">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-base font-semibold px-3 py-1">
                {formatCurrency(item.priceCents, currency, locale)}
              </Badge>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {item.preparationMinutes} min prep
                </span>
                {item.dietaryTags.includes("vegan") && (
                  <span className="flex items-center gap-1 text-success">
                    <Leaf className="w-3 h-3" /> Vegan
                  </span>
                )}
                {item.dietaryTags.includes("vegetarian") && !item.dietaryTags.includes("vegan") && (
                  <span className="flex items-center gap-1 text-success">
                    <Leaf className="w-3 h-3" /> Vegetarian
                  </span>
                )}
                {item.spiceLevel && item.spiceLevel !== "none" && (
                  <span className="flex items-center gap-1 text-warning">
                    <Flame className="w-3 h-3" /> {item.spiceLevel}
                  </span>
                )}
              </div>
            </div>

            {item.allergens.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Allergens</h4>
                <div className="flex flex-wrap gap-2">
                  {item.allergens.map((allergen) => (
                    <Badge key={allergen} variant="outline" className="text-xs capitalize">
                      {allergen.replace("-", " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {item.recommendedPairings && item.recommendedPairings.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Suggested pairings</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {item.recommendedPairings.map((pairing) => (
                    <li key={pairing}>{pairing}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-2xl bg-muted/10 border border-border/30 p-4 text-xs text-muted-foreground space-y-2">
              <p>
                ICUPA labels allergens according to EU 1169/2011. Always confirm with your server if you have severe allergies or dietary requirements.
              </p>
              {item.containsAlcohol && (
                <p className="font-medium text-warning">
                  Contains alcohol. Age verification required in Rwanda (18+) and Malta (17+).
                </p>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="px-6 pb-6">
          <Button className="w-full" size="lg" onClick={() => onAddToCart(item)} disabled={!item.isAvailable}>
            Add to cart
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
