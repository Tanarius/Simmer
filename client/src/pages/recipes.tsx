import { useState, useMemo } from "react";
import { Plus, Search, SlidersHorizontal, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RecipeCard } from "@/components/recipe-card";
import { RecipeViewDialog } from "@/components/recipe-dialog";
import { AddRecipeDialog } from "@/components/recipe-dialog";
import type { Recipe } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const CUISINES = ["all", "tex-mex", "italian", "asian", "american", "other"];
const MEAL_TYPES = ["all", "lunch", "dinner", "either"];
const AVAILABLE_TAGS = ["crockpot", "quick", "make-ahead", "freezer-friendly", "one-pot", "one-pan"];

function parseTags(tagsJson: string | null | undefined): string[] {
  if (!tagsJson) return [];
  try { return JSON.parse(tagsJson); } catch { return []; }
}

export default function RecipesPage() {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [cuisineFilter, setCuisineFilter] = useState("all");
  const [mealTypeFilter, setMealTypeFilter] = useState("all");
  const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const { data: recipes, isLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  const filteredRecipes = useMemo(() => {
    if (!recipes) return [];
    return recipes.filter((r) => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (cuisineFilter !== "all" && r.cuisine !== cuisineFilter) return false;
      if (mealTypeFilter !== "all" && r.mealType !== mealTypeFilter) return false;
      if (showFavoritesOnly && !r.isFavorite) return false;
      if (activeTagFilters.length > 0) {
        const tags = parseTags(r.tags);
        if (!activeTagFilters.every((t) => tags.includes(t))) return false;
      }
      return true;
    });
  }, [recipes, search, cuisineFilter, mealTypeFilter, activeTagFilters, showFavoritesOnly]);

  function toggleTagFilter(tag: string) {
    setActiveTagFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function openRecipe(recipe: Recipe) {
    setSelectedRecipe(recipe);
    setViewDialogOpen(true);
  }

  const filterPillClass = (active: boolean) =>
    cn(
      "text-xs px-3 py-1 rounded-full border font-medium transition-colors cursor-pointer",
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-background text-muted-foreground border-border hover:border-primary/50"
    );

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Recipes</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {recipes?.length ?? 0} recipes · {filteredRecipes.length} showing
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)} data-testid="button-add-recipe">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Recipe
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-3 border-b border-border space-y-2.5 bg-background/80">
        {/* Search */}
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search recipes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
            data-testid="input-search-recipes"
          />
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Cuisine:</span>
          {CUISINES.map((c) => (
            <button
              key={c}
              onClick={() => setCuisineFilter(c)}
              className={filterPillClass(cuisineFilter === c)}
              data-testid={`filter-cuisine-${c}`}
            >
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Meal:</span>
          {MEAL_TYPES.map((m) => (
            <button
              key={m}
              onClick={() => setMealTypeFilter(m)}
              className={filterPillClass(mealTypeFilter === m)}
              data-testid={`filter-meal-${m}`}
            >
              {m === "all" ? "All" : m === "either" ? "Either" : m}
            </button>
          ))}
          <span className="ml-2 text-xs text-muted-foreground font-medium">Tags:</span>
          {AVAILABLE_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTagFilter(tag)}
              className={filterPillClass(activeTagFilters.includes(tag))}
              data-testid={`filter-tag-${tag}`}
            >
              {tag}
            </button>
          ))}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={filterPillClass(showFavoritesOnly)}
            data-testid="filter-favorites"
          >
            ♥ Favorites
          </button>
        </div>
      </div>

      {/* Recipe Grid */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-lg" />
            ))}
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ChefHat className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">No recipes match your filters</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your search or filters</p>
            {(cuisineFilter !== "all" || mealTypeFilter !== "all" || activeTagFilters.length > 0 || search || showFavoritesOnly) && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearch("");
                  setCuisineFilter("all");
                  setMealTypeFilter("all");
                  setActiveTagFilters([]);
                  setShowFavoritesOnly(false);
                }}
                data-testid="button-clear-filters"
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="grid-recipes">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onClick={() => openRecipe(recipe)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <RecipeViewDialog
        recipe={selectedRecipe}
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
      />
      <AddRecipeDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
      />
    </div>
  );
}
