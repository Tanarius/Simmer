import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Shuffle, ShoppingCart, X, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import type { Recipe, WeeklyPlan } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday",
  thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

const CUISINE_COLORS: Record<string, string> = {
  "tex-mex": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "italian": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  "asian": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "american": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "other": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekStart(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatShortDate(monday: Date, dayIndex: number): string {
  const d = new Date(monday);
  d.setDate(d.getDate() + dayIndex);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function parseTags(tagsJson: string | null | undefined): string[] {
  if (!tagsJson) return [];
  try { return JSON.parse(tagsJson); } catch { return []; }
}

type MealSlotKey = `${typeof DAYS[number]}_${"lunch" | "dinner"}`;
type MealsMap = Partial<Record<MealSlotKey, number>>;

export default function PlannerPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const monday = useMemo(() => {
    const base = getMondayOfWeek(new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [weekOffset]);

  const weekStart = formatWeekStart(monday);

  const { data: recipes } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  const { data: plan, isLoading } = useQuery<WeeklyPlan>({
    queryKey: ["/api/plans", weekStart],
  });

  const savePlanMutation = useMutation({
    mutationFn: (meals: MealsMap) =>
      apiRequest("POST", "/api/plans", { weekStart, meals: JSON.stringify(meals) }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans", weekStart] });
    },
  });

  const currentMeals: MealsMap = useMemo(() => {
    if (!plan?.meals) return {};
    try { return JSON.parse(plan.meals); } catch { return {}; }
  }, [plan]);

  function setSlot(day: string, mealTime: "lunch" | "dinner", recipeId: number | null) {
    const key = `${day}_${mealTime}` as MealSlotKey;
    const updated: MealsMap = { ...currentMeals };
    if (recipeId === null) {
      delete updated[key];
    } else {
      updated[key] = recipeId;
    }
    savePlanMutation.mutate(updated);
  }

  function quickFill() {
    if (!recipes) return;
    const updated: MealsMap = { ...currentMeals };

    // Filter for crockpot/make-ahead/easy for lunches
    const lunchCandidates = recipes.filter((r) => {
      const tags = parseTags(r.tags);
      return r.mealType !== "dinner" && (tags.includes("crockpot") || tags.includes("make-ahead") || r.difficulty === "easy");
    });
    const dinnerCandidates = recipes.filter((r) => r.mealType !== "lunch");

    // Track used cuisines for variety
    const usedCuisines: string[] = Object.entries(updated)
      .map(([, id]) => recipes.find((r) => r.id === id)?.cuisine ?? "")
      .filter(Boolean);

    for (const day of DAYS) {
      // Fill lunch
      const lunchKey = `${day}_lunch` as MealSlotKey;
      if (!updated[lunchKey]) {
        // Prefer variety
        const notRecentCuisine = lunchCandidates.filter(
          (r) => !usedCuisines.slice(-3).includes(r.cuisine)
        );
        const pool = notRecentCuisine.length > 0 ? notRecentCuisine : lunchCandidates;
        if (pool.length > 0) {
          const pick = pool[Math.floor(Math.random() * pool.length)];
          updated[lunchKey] = pick.id;
          usedCuisines.push(pick.cuisine);
        }
      }

      // Fill dinner
      const dinnerKey = `${day}_dinner` as MealSlotKey;
      if (!updated[dinnerKey]) {
        const notRecentCuisine = dinnerCandidates.filter(
          (r) => !usedCuisines.slice(-3).includes(r.cuisine)
        );
        const pool = notRecentCuisine.length > 0 ? notRecentCuisine : dinnerCandidates;
        if (pool.length > 0) {
          const pick = pool[Math.floor(Math.random() * pool.length)];
          updated[dinnerKey] = pick.id;
          usedCuisines.push(pick.cuisine);
        }
      }
    }

    savePlanMutation.mutate(updated);
    toast({ title: "Week filled with recipes!" });
  }

  function clearAll() {
    savePlanMutation.mutate({});
  }

  const plannedCount = Object.keys(currentMeals).length;
  const recipeIds = [...new Set(Object.values(currentMeals).filter(Boolean) as number[])];

  const weekLabel = (() => {
    const end = new Date(monday);
    end.setDate(end.getDate() + 6);
    return `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Weekly Plan</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Meal counter */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border",
              plannedCount >= 8
                ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                : "bg-muted text-muted-foreground border-border"
            )}
            data-testid="text-meal-counter"
          >
            <Calendar className="h-3 w-3" />
            {plannedCount} / 14 meals
            {plannedCount >= 8 && plannedCount <= 10 && " ✓"}
          </div>

          <Button variant="outline" size="sm" onClick={quickFill} data-testid="button-quick-fill">
            <Shuffle className="h-3.5 w-3.5 mr-1.5" />
            Quick Fill
          </Button>

          {recipeIds.length > 0 && (
            <Button asChild size="sm" data-testid="button-generate-shopping-list">
              <Link href="/shopping">
                <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                Shopping List
              </Link>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWeekOffset((o) => o - 1)}
            data-testid="button-prev-week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWeekOffset((o) => o + 1)}
            data-testid="button-next-week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {isLoading ? (
          <div className="grid grid-cols-7 gap-3">
            {Array.from({ length: 14 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-3 min-w-[700px]">
            {DAYS.map((day, dayIdx) => (
              <div key={day} className="flex flex-col gap-2">
                {/* Day header */}
                <div className="text-center">
                  <div className="text-xs font-semibold text-foreground">{DAY_LABELS[day]}</div>
                  <div className="text-xs text-muted-foreground">{formatShortDate(monday, dayIdx)}</div>
                </div>

                {/* Lunch slot */}
                <MealSlot
                  label="Lunch"
                  slotKey={`${day}_lunch` as MealSlotKey}
                  recipeId={currentMeals[`${day}_lunch` as MealSlotKey] ?? null}
                  recipes={recipes ?? []}
                  onSet={(id) => setSlot(day, "lunch", id)}
                  onClear={() => setSlot(day, "lunch", null)}
                  isPending={savePlanMutation.isPending}
                />

                {/* Dinner slot */}
                <MealSlot
                  label="Dinner"
                  slotKey={`${day}_dinner` as MealSlotKey}
                  recipeId={currentMeals[`${day}_dinner` as MealSlotKey] ?? null}
                  recipes={recipes ?? []}
                  onSet={(id) => setSlot(day, "dinner", id)}
                  onClear={() => setSlot(day, "dinner", null)}
                  isPending={savePlanMutation.isPending}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      {plannedCount > 0 && (
        <div className="px-6 py-3 border-t border-border bg-background flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {plannedCount} meal{plannedCount !== 1 ? "s" : ""} planned
            {plannedCount < 8 && ` · ${8 - plannedCount} more to reach target`}
            {plannedCount >= 8 && plannedCount <= 10 && " · Target reached!"}
          </p>
          <Button variant="ghost" size="sm" onClick={clearAll} data-testid="button-clear-plan">
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
}

// ---- Meal Slot component ----

interface MealSlotProps {
  label: string;
  slotKey: string;
  recipeId: number | null;
  recipes: Recipe[];
  onSet: (id: number) => void;
  onClear: () => void;
  isPending: boolean;
}

function MealSlot({ label, slotKey, recipeId, recipes, onSet, onClear, isPending }: MealSlotProps) {
  const [open, setOpen] = useState(false);
  const recipe = recipeId != null ? recipes.find((r) => r.id === recipeId) : null;

  if (recipe) {
    return (
      <div
        className="relative group rounded-lg p-2 bg-card border border-card-border text-xs flex flex-col gap-1 min-h-[80px]"
        data-testid={`slot-filled-${slotKey}`}
      >
        <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">{label}</span>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize w-fit",
            CUISINE_COLORS[recipe.cuisine] ?? CUISINE_COLORS["other"]
          )}
        >
          {recipe.cuisine}
        </span>
        <span className="text-foreground font-medium leading-snug line-clamp-2 flex-1">
          {recipe.name}
        </span>
        <button
          onClick={onClear}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-muted"
          aria-label="Remove meal"
          data-testid={`button-clear-slot-${slotKey}`}
          disabled={isPending}
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="rounded-lg p-2 border border-dashed border-border text-xs text-muted-foreground hover:border-primary/50 hover:bg-muted/50 transition-colors min-h-[80px] flex flex-col items-center justify-center gap-1 w-full"
          data-testid={`slot-empty-${slotKey}`}
          disabled={isPending}
        >
          <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
          <span className="text-[10px] opacity-60">+ Pick recipe</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-72" align="start">
        <Command>
          <CommandInput placeholder="Search recipes..." data-testid={`input-search-slot-${slotKey}`} />
          <CommandEmpty>No recipes found.</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {recipes.map((r) => (
              <CommandItem
                key={r.id}
                value={r.name}
                onSelect={() => {
                  onSet(r.id);
                  setOpen(false);
                }}
                className="flex items-center gap-2 cursor-pointer"
                data-testid={`option-recipe-${r.id}`}
              >
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize shrink-0",
                    CUISINE_COLORS[r.cuisine] ?? CUISINE_COLORS["other"]
                  )}
                >
                  {r.cuisine}
                </span>
                <span className="text-sm flex-1 truncate">{r.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
