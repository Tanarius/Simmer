import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronDown, ChevronRight, ChefHat, Trash2, ShoppingBasket, CalendarPlus, CalendarCheck, type LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getFoodEmoji, getCuisineGradient } from "@/lib/food-emoji";
import { DicebearAvatar } from "@/components/DicebearAvatar";
import type { Recipe } from "@shared/schema";

function compactTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return "now";
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return format(new Date(iso), 'MMM d');
}

interface ActivityGroup {
  username: string;
  avatar: string | null;
  action: string;
  count: number;
  recipeNames: string[];
  recipeIds: number[];
  latestAt: string;
}

const ACTION_META: Record<string, { icon: LucideIcon; color: string; label: (n: number) => string }> = {
  recipe_added:    { icon: ChefHat,        color: "text-emerald-500", label: (n) => `added ${n === 1 ? "a recipe" : `${n} recipes`}` },
  recipe_deleted:  { icon: Trash2,         color: "text-red-400",     label: (n) => `removed ${n === 1 ? "a recipe" : `${n} recipes`}` },
  pantry_added:    { icon: ShoppingBasket, color: "text-blue-400",    label: (n) => `added ${n === 1 ? "a pantry item" : `${n} pantry items`}` },
  plan_meal_added: { icon: CalendarPlus,   color: "text-orange-400",  label: (n) => `added ${n === 1 ? "a meal" : `${n} meals`} to the plan` },
  plan_updated:    { icon: CalendarCheck,  color: "text-amber-400",   label: () => "updated the weekly plan" },
};

const AVATAR_GRADIENTS = [
  "from-orange-600 to-amber-700",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-pink-500 to-rose-500",
  "from-blue-500 to-cyan-500",
  "from-red-500 to-pink-500",
];

function avatarGradient(username: string): string {
  let h = 0;
  for (const c of username) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

function RecipeHoverPreview({ recipeId, recipeName }: { recipeId: number; recipeName: string }) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { data: recipes } = useQuery<Recipe[]>({ queryKey: ["/api/recipes"], staleTime: Infinity });
  const recipe = recipes?.find(r => r.id === recipeId);

  function handleClick() {
    // Validate ID is a safe positive integer before storing
    const safeId = parseInt(String(recipeId), 10);
    if (!Number.isFinite(safeId) || safeId <= 0) return;

    if (window.location.hash.startsWith("#/recipes")) {
      // Already on the recipes page — open dialog directly via event
      window.dispatchEvent(new CustomEvent("openRecipe", { detail: { recipeId: safeId } }));
    } else {
      // Anywhere else (home, planner, shopping…) — store and navigate to recipes page
      sessionStorage.setItem("openRecipeId", String(safeId));
      setLocation("/recipes");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className="cursor-pointer font-semibold text-foreground hover:text-primary transition-colors underline decoration-dotted underline-offset-2"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={handleClick}
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
          <div className="h-24 w-full relative overflow-hidden">
            {recipe.imageUrl ? (
              <img src={recipe.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className={cn("w-full h-full bg-zinc-900 flex items-center justify-center relative overflow-hidden")}>
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
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1.5">
        Activity
      </p>
      <div className="space-y-0.5">
        {groups.map((g, i) => {
          const meta = ACTION_META[g.action];
          const Icon = meta?.icon ?? ChefHat;
          const iconColor = meta?.color ?? "text-muted-foreground";
          const label = meta?.label(g.count) ?? g.action;
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
                {/* Avatar — Dicebear if set, gradient initials fallback */}
                <div className="shrink-0 mt-0.5">
                  <DicebearAvatar username={g.username} avatarStyle={g.avatar} size={20} />
                </div>

                {/* Action icon */}
                <Icon className={cn("h-3 w-3 shrink-0 mt-1", iconColor)} />

                {/* Text — two lines: username then action */}
                <span className="flex-1 text-[11px] leading-snug min-w-0">
                  <span className="font-semibold text-sidebar-foreground block truncate">{g.username}</span>
                  <span className={cn("font-medium block truncate", iconColor)}>{label}</span>
                </span>

                {/* Compact timestamp */}
                <span className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap leading-tight mt-0.5">
                  {compactTime(g.latestAt)}
                </span>

                {hasNames && (
                  isExpanded
                    ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
                    : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
                )}
              </button>

              {isExpanded && hasNames && (
                <ul className="ml-9 mb-0.5 space-y-0.5">
                  {g.recipeNames.map((name, j) => (
                    <li key={j} className="text-[11px] text-muted-foreground truncate px-1 py-0.5">
                      {g.recipeIds[j]
                        ? <RecipeHoverPreview recipeId={g.recipeIds[j]} recipeName={name} />
                        : <span className="font-medium text-foreground">{name}</span>
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
