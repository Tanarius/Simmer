import { useState, useMemo } from "react";
import { Plus, Search, SlidersHorizontal, ChefHat, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RecipeCard } from "@/components/recipe-card";
import { RecipeViewDialog } from "@/components/recipe-dialog";
import { AddRecipeDialog } from "@/components/recipe-dialog";
import { ChefMode } from "@/components/ChefMode";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Recipe } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const CUISINES = ["all", "tex-mex", "italian", "asian", "american", "other"];
const MEAL_TYPES = ["all", "breakfast", "lunch", "dinner", "either"];
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Recipe Library</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{recipes?.length ?? 0} total recipes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setAddDialogOpen(true)} data-testid="button-add-recipe">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Recipe
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="library" className="w-full">
          <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
            <TabsList>
              <TabsTrigger value="library">Library</TabsTrigger>
              <TabsTrigger value="ai-chef" className="text-purple-600 dark:text-purple-400">
                <Sparkles className="w-4 h-4 mr-2" />
                AI Chef Mode
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2 w-full sm:w-auto relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search recipes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-[250px] pl-9 bg-background"
                data-testid="input-search-recipes"
              />
            </div>
          </div>

          <TabsContent value="ai-chef" className="m-0">
            <ChefMode />
          </TabsContent>

          <TabsContent value="library" className="m-0 space-y-6">
            {/* Filter Bar */}
            <div className="space-y-2.5 bg-background/80">
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
          </TabsContent>
        </Tabs>
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
