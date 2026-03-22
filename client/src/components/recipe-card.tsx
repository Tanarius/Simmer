import { Heart, Clock, ChefHat, Utensils } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Recipe } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format-time";

const cuisineColors: Record<string, string> = {
  "tex-mex": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "italian": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  "asian": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "american": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "other": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

const mealTypeLabels: Record<string, string> = {
  lunch: "Lunch",
  dinner: "Dinner",
  either: "Lunch / Dinner",
};

const difficultyColors: Record<string, string> = {
  easy: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
};

function parseTags(tagsJson: string | null): string[] {
  if (!tagsJson) return [];
  try {
    return JSON.parse(tagsJson);
  } catch {
    return [];
  }
}

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
}

export function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  const queryClient = useQueryClient();

  const favoriteMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/recipes/${recipe.id}/favorite`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
    },
  });

  const tags = parseTags(recipe.tags);
  const totalTime = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    favoriteMutation.mutate();
  };

  return (
    <Card
      className="cursor-pointer hover-elevate transition-shadow duration-150 border border-card-border"
      onClick={onClick}
      data-testid={`card-recipe-${recipe.id}`}
    >
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3
              className="text-sm font-semibold leading-snug text-foreground truncate"
              data-testid={`text-recipe-name-${recipe.id}`}
            >
              {recipe.name}
            </h3>
            {recipe.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                {recipe.description}
              </p>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0 -mt-1 -mr-1"
            onClick={handleFavorite}
            data-testid={`button-favorite-${recipe.id}`}
            aria-label={recipe.isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart
              className={cn(
                "h-4 w-4 transition-colors",
                recipe.isFavorite
                  ? "fill-red-500 text-red-500"
                  : "text-muted-foreground"
              )}
            />
          </Button>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
              cuisineColors[recipe.cuisine] ?? cuisineColors["other"]
            )}
            data-testid={`badge-cuisine-${recipe.id}`}
          >
            {recipe.cuisine}
          </span>
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground"
          >
            {mealTypeLabels[recipe.mealType] ?? recipe.mealType}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
              difficultyColors[recipe.difficulty] ?? ""
            )}
          >
            {recipe.difficulty}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Clock className="h-3 w-3 shrink-0" />
            {formatTime(totalTime)}
          </span>
          <span className="flex items-center gap-1">
            <Utensils className="h-3 w-3" />
            {recipe.servings} servings
          </span>
          {tags.includes("crockpot") && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
              🥘 Crockpot
            </span>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs px-1.5 py-0 h-5 capitalize"
                data-testid={`badge-tag-${recipe.id}-${tag}`}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
