import { useState } from "react";
import { Heart, Clock, Utensils, ExternalLink, CalendarPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Recipe } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format-time";
import { getFoodEmoji, getCuisineGradient } from "@/lib/food-emoji";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
type MealSlotKey = `${typeof DAYS[number]}_${"lunch" | "dinner"}`;

function getMondayOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
function formatWeekStart(d: Date) { return d.toISOString().split("T")[0]; }

interface WeeklyPlan {
  id?: number;
  weekStart: string;
  meals: string;
}

const cuisineColors: Record<string, string> = {
  "tex-mex":       "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "italian":       "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  "asian":         "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "american":      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "mediterranean": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  "indian":        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  "other":         "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
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

function AddToWeekButton({ recipe }: { recipe: Recipe }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const weekStart = formatWeekStart(getMondayOfWeek(new Date()));

  const { data: plan } = useQuery<WeeklyPlan>({
    queryKey: ["/api/plans", weekStart],
    enabled: open,
  });

  const meals: Record<string, string> = (() => {
    if (!plan?.meals) return {};
    try { return JSON.parse(plan.meals); } catch { return {}; }
  })();

  const addMutation = useMutation({
    mutationFn: (slot: MealSlotKey) => {
      const updated = { ...meals, [slot]: String(recipe.id) };
      return apiRequest("POST", "/api/plans", {
        weekStart,
        meals: JSON.stringify(updated),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans", weekStart] });
      setOpen(false);
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="absolute bottom-1.5 right-1.5 h-8 w-8 bg-background/80 hover:bg-background backdrop-blur-sm rounded-full text-foreground"
          onClick={(e) => e.stopPropagation()}
          aria-label="Add to week"
          data-testid={`button-add-to-week-${recipe.id}`}
        >
          <CalendarPlus className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-3"
        onClick={(e) => e.stopPropagation()}
        side="top"
        align="end"
      >
        <p className="text-xs font-semibold text-muted-foreground mb-2 tracking-wide uppercase">Add to week</p>
        <div className="grid gap-1">
          {/* Day headers */}
          <div className="grid grid-cols-8 gap-1 mb-0.5">
            <div className="w-10" />
            {DAY_LABELS.map((d, i) => (
              <div key={i} className="w-7 text-center text-xs text-muted-foreground font-medium">{d}</div>
            ))}
          </div>
          {(["lunch", "dinner"] as const).map(mealTime => (
            <div key={mealTime} className="grid grid-cols-8 gap-1 items-center">
              <div className="w-10 text-xs text-muted-foreground capitalize font-medium">{mealTime === "lunch" ? "☀️" : "🌙"}</div>
              {DAYS.map(day => {
                const key = `${day}_${mealTime}` as MealSlotKey;
                const val = meals[key];
                const isThis = val === String(recipe.id);
                const isFilled = !!val && !isThis;
                return (
                  <button
                    key={key}
                    disabled={isFilled || addMutation.isPending}
                    onClick={() => addMutation.mutate(key)}
                    className={cn(
                      "w-7 h-7 rounded-md text-xs flex items-center justify-center transition-colors border",
                      isThis
                        ? "bg-purple-600 border-purple-600 text-white"
                        : isFilled
                        ? "bg-muted border-border text-muted-foreground cursor-not-allowed opacity-50"
                        : "border-border hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-muted-foreground"
                    )}
                    title={isThis ? "Already planned here" : isFilled ? "Slot taken" : `Add to ${day} ${mealTime}`}
                  >
                    {isThis ? "✓" : isFilled ? "·" : "+"}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
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
          <div className="w-full h-full bg-zinc-900 flex items-center justify-center relative overflow-hidden">
            <div className={cn("absolute inset-0 opacity-20 bg-gradient-to-br", gradient)} />
            <span className="relative text-5xl select-none" role="img" aria-label={recipe.name}>
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
        {/* Add to week button */}
        <AddToWeekButton recipe={recipe} />
        {/* Cooking-method badge — most prominent tag shown on image */}
        {(() => {
          const methodTag = ["crockpot","slow-cook","air-fryer","grilled","one-pot","one-pan"].find(t => tags.includes(t));
          if (!methodTag) return null;
          const meta: Record<string,string> = { crockpot:"🥘 Crockpot", "slow-cook":"🫕 Slow Cook", "air-fryer":"🌬️ Air Fryer", grilled:"🔥 Grilled", "one-pot":"🍲 One Pot", "one-pan":"🍳 One Pan" };
          return <span className="absolute top-1.5 left-1.5 bg-black/40 backdrop-blur-sm text-white text-xs font-medium px-2 py-0.5 rounded-full">{meta[methodTag]}</span>;
        })()}
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

        {/* Tags — color-coded with emoji */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map((tag) => {
              const meta: Record<string,{emoji:string;cls:string}> = {
                crockpot:           {emoji:"🥘",cls:"bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800"},
                "slow-cook":        {emoji:"🫕",cls:"bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800"},
                quick:              {emoji:"⚡",cls:"bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800"},
                "make-ahead":       {emoji:"📦",cls:"bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800"},
                "freezer-friendly": {emoji:"❄️",cls:"bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800"},
                "one-pot":          {emoji:"🍲",cls:"bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800"},
                "one-pan":          {emoji:"🍳",cls:"bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"},
                "air-fryer":        {emoji:"🌬️",cls:"bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800"},
                grilled:            {emoji:"🔥",cls:"bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800"},
              };
              const t = meta[tag];
              return (
                <span key={tag}
                  className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium", t?.cls ?? "bg-muted text-muted-foreground border border-border")}
                  data-testid={`badge-tag-${recipe.id}-${tag}`}
                >
                  {t?.emoji} {tag}
                </span>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
