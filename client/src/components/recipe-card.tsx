import { useState } from "react";
import { Heart, Clock, Utensils, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Recipe } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format-time";
import { getFoodEmoji, getCuisineGradient } from "@/lib/food-emoji";

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
  try { return JSON.parse(tagsJson); } catch { return []; }
}

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
}

export function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  const queryClient = useQueryClient();
  const [imgError, setImgError] = useState(false);

  const favoriteMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/recipes/${recipe.id}/favorite`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
    },
  });

  const tags = parseTags(recipe.tags);
  const totalTime = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
  const emoji = getFoodEmoji(recipe.name, recipe.cuisine);
  const gradient = getCuisineGradient(recipe.cuisine);
  const hasImage = recipe.imageUrl && !imgError;

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    favoriteMutation.mutate();
  };

  return (
    <Card
      className="cursor-pointer hover-elevate transition-shadow duration-150 border border-card-border overflow-hidden"
      onClick={onClick}
      data-testid={`card-recipe-${recipe.id}`}
    >
      {/* Visual banner — photo if available, emoji gradient fallback */}
      <div className="relative h-36 overflow-hidden">
        {hasImage ? (
          <img
            src={recipe.imageUrl!}
            alt={recipe.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={cn(
            "w-full h-full bg-gradient-to-br flex items-center justify-center",
            gradient
          )}>
            <span className="text-5xl drop-shadow-md select-none" role="img" aria-label={recipe.name}>
              {emoji}
            </span>
          </div>
        )}
        {/* Dark overlay for text readability on photos */}
        {hasImage && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        )}
        {/* Favorite button overlay */}
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-1.5 right-1.5 h-8 w-8 bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-full"
          onClick={handleFavorite}
          data-testid={`button-favorite-${recipe.id}`}
          aria-label={recipe.isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-colors",
              recipe.isFavorite
                ? "fill-red-500 text-red-500"
                : "text-white"
            )}
          />
        </Button>
        {/* Crockpot indicator */}
        {tags.includes("crockpot") && (
          <span className="absolute top-1.5 left-1.5 bg-black/30 backdrop-blur-sm text-white text-xs font-medium px-2 py-0.5 rounded-full">
            🥘 Crockpot
          </span>
        )}
      </div>

      <CardContent className="p-3.5">
        {/* Title */}
        <h3
          className="text-sm font-semibold leading-snug text-foreground truncate mb-1"
          data-testid={`text-recipe-name-${recipe.id}`}
        >
          {recipe.name}
        </h3>
        {recipe.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2.5">
            {recipe.description}
          </p>
        )}

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
              cuisineColors[recipe.cuisine] ?? cuisineColors["other"]
            )}
            data-testid={`badge-cuisine-${recipe.id}`}
          >
            {recipe.cuisine}
          </span>
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
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
          {recipe.sourceUrl && (
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
              data-testid={`link-source-${recipe.id}`}
              aria-label="View original recipe"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Tags */}
        {tags.filter(t => t !== "crockpot").length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.filter(t => t !== "crockpot").map((tag) => (
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
