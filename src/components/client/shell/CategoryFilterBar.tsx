import { Button } from "@icupa/ui/button";
import { ScrollArea } from "@icupa/ui/scroll-area";
import type { MenuCategory } from "@/data/menu";

interface CategoryFilterBarProps {
  categories: MenuCategory[];
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
}

export function CategoryFilterBar({
  categories,
  activeCategory,
  onCategoryChange,
}: CategoryFilterBarProps) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-white/10 bg-white/5 px-4 py-3">
      <ScrollArea className="w-full">
        <div className="flex gap-2 min-w-full">
          <Button
            variant={activeCategory === "all" ? "default" : "secondary"}
            size="sm"
            className="rounded-full px-4"
            onClick={() => onCategoryChange("all")}
          >
            All dishes
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={activeCategory === category.id ? "default" : "secondary"}
              size="sm"
              className="rounded-full px-4"
              onClick={() => onCategoryChange(category.id)}
            >
              {category.name}
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
