import { useState, useMemo } from "react";
import { Plus, Search, ChefHat, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RecipeCard } from "@/components/recipe-card";
import { RecipeViewDialog } from "@/components/recipe-dialog";
import { AddRecipeDialog } from "@/components/recipe-dialog";
import type { Recipe } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { CopilotPanel } from "@/components/CopilotPanel";

const CUISINES = ["all", "tex-mex", "italian", "asian", "american", "mediterranean", "indian", "other"];
const MEAL_TYPES = ["all", "lunch", "dinner", "either"];
const AVAILABLE_TAGS = ["crockpot", "slow-cook", "grilled", "quick", "make-ahead", "freezer-friendly", "one-pot", "one-pan", "air-fryer"];

function parseTags(tagsJson: string | null | undefined): string[] {
  if (!tagsJson) return [];
  try { return JSON.parse(tagsJson); } catch { return []; }
}

export default function RecipesPage() {
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
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

  const selectedRecipe = recipes?.find(r => r.id === selectedRecipeId) ?? null;

  function openRecipe(recipe: Recipe) {
    setSelectedRecipeId(recipe.id);
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
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Recipe Library</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{recipes?.length ?? 0} recipes</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-44 pl-9 bg-background h-9"
              data-testid="input-search-recipes"
            />
          </div>
          <Button size="sm" variant="outline" className="hidden sm:flex gap-1.5 border-violet-500/40 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30" onClick={() => setCopilotOpen(true)} data-testid="button-find-recipes">
            <Sparkles className="h-4 w-4" />
            Find Recipes
          </Button>
          <Button size="sm" className="hidden sm:flex" onClick={() => setAddDialogOpen(true)} data-testid="button-add-recipe">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Recipe
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 sm:px-6 py-4 space-y-4">
        {/* Mobile search + add */}
        <div className="flex gap-2 sm:hidden">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search recipes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 bg-background"
              data-testid="input-search-recipes-mobile"
            />
          </div>
          <Button variant="outline" className="gap-1.5 border-violet-500/40 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30" onClick={() => setCopilotOpen(true)} data-testid="button-find-recipes-mobile">
            <Sparkles className="h-4 w-4" />
            Find Recipes
          </Button>
          <Button onClick={() => setAddDialogOpen(true)} data-testid="button-add-recipe-mobile">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Recipe
          </Button>
        </div>

        {/* Filter Bar — horizontally scrollable on mobile */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs text-muted-foreground font-medium shrink-0">Cuisine:</span>
            {CUISINES.map((c) => (
              <button
                key={c}
                onClick={() => setCuisineFilter(c)}
                className={cn(filterPillClass(cuisineFilter === c), "shrink-0")}
                data-testid={`filter-cuisine-${c}`}
              >
                {c === "all" ? "All" : c}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs text-muted-foreground font-medium shrink-0">Meal:</span>
            {MEAL_TYPES.map((m) => (
              <button
                key={m}
                onClick={() => setMealTypeFilter(m)}
                className={cn(filterPillClass(mealTypeFilter === m), "shrink-0")}
                data-testid={`filter-meal-${m}`}
              >
                {m === "all" ? "All" : m === "either" ? "Either" : m}
              </button>
            ))}
            <span className="text-xs text-muted-foreground font-medium shrink-0 ml-1">Tags:</span>
            {AVAILABLE_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTagFilter(tag)}
                className={cn(filterPillClass(activeTagFilters.includes(tag)), "shrink-0")}
                data-testid={`filter-tag-${tag}`}
              >
                {tag}
              </button>
            ))}
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={cn(filterPillClass(showFavoritesOnly), "shrink-0")}
              data-testid="filter-favorites"
            >
              ♥ Favorites
            </button>
          </div>
        </div>

        {/* Recipe Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-lg" />
            ))}
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ChefHat className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">No recipes match your filters</p>
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
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4" data-testid="grid-recipes">
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
      <CopilotPanel open={copilotOpen} onOpenChange={setCopilotOpen} />
    </div>
  );
}
