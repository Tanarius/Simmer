import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getFoodEmoji, getCuisineGradient } from "@/lib/food-emoji";
import type { Recipe } from "@shared/schema";

interface ActivityGroup {
  username: string;
  action: string;
  count: number;
  recipeNames: string[];
  recipeIds: number[];
  latestAt: string;
}

const ACTION_LABELS: Record<string, (count: number) => string> = {
  recipe_added:    (n) => `added ${n === 1 ? "a recipe" : `${n} recipes`}`,
  recipe_deleted:  (n) => `removed ${n === 1 ? "a recipe" : `${n} recipes`}`,
  pantry_added:    (n) => `added ${n === 1 ? "a pantry item" : `${n} pantry items`}`,
  plan_meal_added: (n) => `added ${n === 1 ? "a meal" : `${n} meals`} to the plan`,
  plan_updated:    (_) => "updated the weekly plan",
};

function RecipeHoverPreview({ recipeId, recipeName }: { recipeId: number; recipeName: string }) {
  const [open, setOpen] = useState(false);
  const { data: recipes } = useQuery<Recipe[]>({ queryKey: ["/api/recipes"], staleTime: Infinity });
  const recipe = recipes?.find(r => r.id === recipeId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className="cursor-pointer hover:text-foreground transition-colors underline decoration-dotted underline-offset-2"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {recipeName}
        </span>
      </PopoverTrigger>
      {recipe && (
        <PopoverContent
          className="p-0 w-48 overflow-hidden"
          side="right"
          align="start"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {/* Image or emoji gradient */}
          <div className="h-24 w-full relative overflow-hidden">
            {recipe.imageUrl ? (
              <img src={recipe.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className={cn("w-full h-full bg-zinc-900 flex items-center justify-center relative", "overflow-hidden")}>
                <div className={cn("absolute inset-0 opacity-20 bg-gradient-to-br", getCuisineGradient(recipe.cuisine))} />
                <span className="text-4xl relative">{getFoodEmoji(recipe.name, recipe.cuisine)}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
          <div className="p-2.5">
            <p className="text-xs font-semibold leading-snug">{recipe.name}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] capitalize text-muted-foreground">{recipe.cuisine}</span>
              {(recipe.prepTime ?? 0) + (recipe.cookTime ?? 0) > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  · {(recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)}m
                </span>
              )}
            </div>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}

export function ActivityFeed() {
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: groups = [] } = useQuery<ActivityGroup[]>({
    queryKey: ["/api/activity"],
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (groups.length === 0) return null;

  return (
    <div className="px-2 py-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 px-1.5">
        Activity
      </p>
      <div className="space-y-0.5">
        {groups.map((g, i) => {
          const hasNames = g.recipeNames.length > 0;
          const isExpanded = expanded === i;
          return (
            <div key={i}>
              <button
                onClick={() => hasNames && setExpanded(isExpanded ? null : i)}
                className={cn(
                  "w-full text-left flex items-start gap-2 rounded-md px-1.5 py-1.5 transition-colors",
                  hasNames ? "hover:bg-sidebar-accent cursor-pointer" : "cursor-default"
                )}
              >
                <span className="shrink-0 text-[9px] font-bold rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground uppercase leading-tight mt-0.5 min-w-[20px] text-center">
                  {g.username.slice(0, 2)}
                </span>
                <span className="flex-1 text-[11px] text-sidebar-foreground leading-snug">
                  <span className="font-medium">{g.username}</span>{" "}
                  <span className="text-muted-foreground">
                    {ACTION_LABELS[g.action]?.(g.count) ?? g.action}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap leading-tight mt-0.5">
                  {formatDistanceToNow(new Date(g.latestAt), { addSuffix: false })}
                </span>
                {hasNames && (
                  isExpanded
                    ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
                    : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
                )}
              </button>
              {isExpanded && hasNames && (
                <ul className="ml-8 mb-0.5 space-y-0.5">
                  {g.recipeNames.map((name, j) => (
                    <li key={j} className="text-[11px] text-muted-foreground truncate px-1 py-0.5">
                      {g.recipeIds[j]
                        ? <RecipeHoverPreview recipeId={g.recipeIds[j]} recipeName={name} />
                        : name
                      }
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
