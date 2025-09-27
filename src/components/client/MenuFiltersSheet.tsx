import { useMemo, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AllergenCode } from "@/data/menu";

type DietaryTag = "vegan" | "vegetarian" | "gluten-free" | "dairy-free" | "halal" | "spicy" | "contains-alcohol";

export interface MenuFilters {
  excludedAllergens: AllergenCode[];
  dietaryTags: DietaryTag[];
  availableOnly: boolean;
  maxPrepMinutes?: number;
}

interface MenuFiltersSheetProps {
  trigger: ReactNode;
  filters: MenuFilters;
  onChange: (filters: MenuFilters) => void;
  allergenOptions: { code: AllergenCode; label: string }[];
  dietaryOptions: readonly DietaryTag[];
}

export function MenuFiltersSheet({ trigger, filters, onChange, allergenOptions, dietaryOptions }: MenuFiltersSheetProps) {
  const [open, setOpen] = useState(false);

  const sliderValue = useMemo(() => {
    if (!filters.maxPrepMinutes) {
      return 45;
    }
    return Math.min(Math.max(filters.maxPrepMinutes, 5), 45);
  }, [filters.maxPrepMinutes]);

  const handleAllergenToggle = (code: AllergenCode, checked: boolean) => {
    const next = checked
      ? [...filters.excludedAllergens, code]
      : filters.excludedAllergens.filter((item) => item !== code);
    onChange({ ...filters, excludedAllergens: next });
  };

  const handleDietaryToggle = (tag: DietaryTag, checked: boolean) => {
    const next = checked ? [...filters.dietaryTags, tag] : filters.dietaryTags.filter((item) => item !== tag);
    onChange({ ...filters, dietaryTags: next });
  };

  const handleMaxPrepChange = (value: number | undefined) => {
    onChange({ ...filters, maxPrepMinutes: value });
  };

  const resetFilters = () => {
    onChange({ excludedAllergens: [], dietaryTags: [], availableOnly: true, maxPrepMinutes: undefined });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-3xl bg-background/95 backdrop-blur-xl">
        <SheetHeader className="text-left">
          <SheetTitle className="text-lg">Refine menu</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Availability</h3>
              <Button variant="ghost" size="sm" className="text-xs" onClick={resetFilters}>
                Reset
              </Button>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-border/40 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Show available dishes only</p>
                <p className="text-xs text-muted-foreground">Hide items currently 86'd or off the line</p>
              </div>
              <Switch
                checked={filters.availableOnly}
                onCheckedChange={(checked) => onChange({ ...filters, availableOnly: checked })}
              />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-medium mb-3">Exclude allergens</h3>
            <div className="grid grid-cols-2 gap-2">
              {allergenOptions.map((option) => {
                const checked = filters.excludedAllergens.includes(option.code);
                return (
                  <label
                    key={option.code}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer transition-colors",
                      checked ? "border-destructive/60 bg-destructive/10" : "border-border/40 hover:border-border"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => handleAllergenToggle(option.code, value === true)}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-medium mb-3">Dietary preferences</h3>
            <div className="flex flex-wrap gap-2">
              {dietaryOptions.map((tag) => {
                const checked = filters.dietaryTags.includes(tag as DietaryTag);
                return (
                  <Badge
                    key={tag}
                    variant={checked ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer text-xs capitalize px-3 py-1 rounded-xl",
                      checked ? "bg-primary text-primary-foreground" : "hover:bg-primary/10"
                    )}
                    onClick={() => handleDietaryToggle(tag as DietaryTag, !checked)}
                  >
                    {tag.replace("-", " ")}
                  </Badge>
                );
              })}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Prep time</h3>
              <Badge variant="outline" className="text-xs">
                {filters.maxPrepMinutes ? `${filters.maxPrepMinutes} min` : "Any"}
              </Badge>
            </div>
            <div className="mt-4 space-y-4">
              <Slider
                value={[sliderValue]}
                max={45}
                min={5}
                step={5}
                onValueChange={([value]) => handleMaxPrepChange(value)}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5 min</span>
                <span>25 min</span>
                <span>45 min</span>
              </div>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
