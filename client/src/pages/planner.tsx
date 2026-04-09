import { useState, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Shuffle, ShoppingCart, X,
  Calendar, Search, GripVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandInput, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import type { Recipe, WeeklyPlan } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { getFoodEmoji, getCuisineGradient } from "@/lib/food-emoji";
import { formatTime } from "@/lib/format-time";

// ─── constants ────────────────────────────────────────────────────────────────

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed",
  thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};

const CUISINE_COLORS: Record<string, string> = {
  "tex-mex":   "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "italian":   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  "asian":     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "american":  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "other":     "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

const MEAL_ICONS: Record<string, string> = {
  breakfast: "☕", lunch: "☀️", dinner: "🌙",
};

type MealTime = "breakfast" | "lunch" | "dinner";
type MealSlotKey = `${typeof DAYS[number]}_${MealTime}`;
type MealsMap = Partial<Record<MealSlotKey, number>>;

// ─── helpers ──────────────────────────────────────────────────────────────────

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}
function formatWeekStart(d: Date) { return d.toISOString().split("T")[0]; }
function formatShortDate(monday: Date, idx: number) {
  const d = new Date(monday);
  d.setDate(d.getDate() + idx);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── PlannerPage ──────────────────────────────────────────────────────────────

export default function PlannerPage() {
  const [weekOffset, setWeekOffset]   = useState(0);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [sidebarTab, setSidebarTab]   = useState<"all" | MealTime>("all");
  const [dragOver, setDragOver]       = useState<string | null>(null);
  const { toast }                     = useToast();
  const queryClient                   = useQueryClient();

  // profile → breakfast toggle
  const { data: profileData } = useQuery({ queryKey: ["/api/profile"], retry: false });
  const profile = profileData as any;
  const breakfastEnabled = !!profile?.breakfastEnabled;
  const mealSlots: MealTime[] = breakfastEnabled
    ? ["breakfast", "lunch", "dinner"]
    : ["lunch", "dinner"];
  const maxMeals = DAYS.length * mealSlots.length;

  const monday   = useMemo(() => {
    const base = getMondayOfWeek(new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [weekOffset]);
  const weekStart = formatWeekStart(monday);

  const { data: recipes } = useQuery<Recipe[]>({ queryKey: ["/api/recipes"] });
  const { data: plan, isLoading } = useQuery<WeeklyPlan>({ queryKey: ["/api/plans", weekStart] });

  const savePlan = useMutation({
    mutationFn: (meals: MealsMap) =>
      apiRequest("POST", "/api/plans", { weekStart, meals: JSON.stringify(meals) }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/plans", weekStart] }),
  });

  const patchProfile = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("PATCH", "/api/profile", data).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/profile"] }),
  });

  const currentMeals: MealsMap = useMemo(() => {
    if (!plan?.meals) return {};
    try { return JSON.parse(plan.meals); } catch { return {}; }
  }, [plan]);

  function setSlot(day: string, mealTime: MealTime, recipeId: number | null) {
    const key = `${day}_${mealTime}` as MealSlotKey;
    const next: MealsMap = { ...currentMeals };
    if (recipeId === null) delete next[key]; else next[key] = recipeId;
    savePlan.mutate(next);
  }

  function quickFill() {
    if (!recipes) return;
    const next: MealsMap = { ...currentMeals };
    const usedCuisines: string[] = Object.values(next)
      .map(id => recipes.find(r => r.id === id)?.cuisine ?? "").filter(Boolean);

    for (const day of DAYS) {
      for (const mt of mealSlots) {
        const key = `${day}_${mt}` as MealSlotKey;
        if (next[key]) continue;
        let pool: Recipe[];
        if (mt === "breakfast") {
          pool = recipes.filter(r => r.mealType === "breakfast" || r.mealType === "either");
        } else if (mt === "dinner") {
          pool = recipes.filter(r => r.mealType !== "lunch" && r.mealType !== "breakfast");
        } else {
          pool = recipes.filter(r => {
            const tags = r.tags ? JSON.parse(r.tags) : [];
            return r.mealType !== "dinner" && (tags.includes("crockpot") || tags.includes("make-ahead") || r.difficulty === "easy");
          });
          if (pool.length === 0) pool = recipes.filter(r => r.mealType !== "dinner");
        }
        const fresh = pool.filter(r => !usedCuisines.slice(-3).includes(r.cuisine));
        const candidates = fresh.length ? fresh : pool;
        if (candidates.length) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          next[key] = pick.id;
          usedCuisines.push(pick.cuisine);
        }
      }
    }
    savePlan.mutate(next);
    toast({ title: "Week filled!" });
  }

  const plannedCount = Object.keys(currentMeals).length;
  const recipeIds    = Array.from(new Set(Object.values(currentMeals).filter(Boolean) as number[]));

  const weekLabel = (() => {
    const end = new Date(monday); end.setDate(end.getDate() + 6);
    return `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  })();

  // sidebar recipe filter
  const sidebarRecipes = useMemo(() => {
    if (!recipes) return [];
    return recipes.filter(r => {
      const matchSearch = !sidebarSearch || r.name.toLowerCase().includes(sidebarSearch.toLowerCase());
      const matchTab = sidebarTab === "all" || r.mealType === sidebarTab || r.mealType === "either";
      return matchSearch && matchTab;
    });
  }, [recipes, sidebarSearch, sidebarTab]);

  // drop handler
  function onDrop(day: string, mt: MealTime, e: React.DragEvent) {
    e.preventDefault();
    setDragOver(null);
    const id = parseInt(e.dataTransfer.getData("recipeId"));
    if (!isNaN(id)) setSlot(day, mt, id);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Weekly Plan</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{weekLabel}</p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {/* Breakfast quick-toggle */}
          <button
            onClick={() => patchProfile.mutate({ breakfastEnabled: breakfastEnabled ? 0 : 1 })}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors",
              breakfastEnabled
                ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700"
                : "bg-muted text-muted-foreground border-border hover:border-primary/40"
            )}
            title={breakfastEnabled ? "Disable breakfast row" : "Enable breakfast row"}
          >
            ☕ Breakfast {breakfastEnabled ? "on" : "off"}
          </button>

          {/* Meal counter */}
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border",
            plannedCount >= 8
              ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
              : "bg-muted text-muted-foreground border-border"
          )} data-testid="text-meal-counter">
            <Calendar className="h-3 w-3" />
            {plannedCount} / {maxMeals}
            {plannedCount >= 8 && " ✓"}
          </div>

          <Button variant="outline" size="sm" onClick={quickFill} data-testid="button-quick-fill">
            <Shuffle className="h-3.5 w-3.5 mr-1" /> Quick Fill
          </Button>

          {recipeIds.length > 0 && (
            <Button asChild size="sm" data-testid="button-generate-shopping-list">
              <Link href="/shopping">
                <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Shopping List
              </Link>
            </Button>
          )}

          <Button variant="ghost" size="icon" onClick={() => setWeekOffset(o => o - 1)} data-testid="button-prev-week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setWeekOffset(o => o + 1)} data-testid="button-next-week">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Body: sidebar + grid ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Recipe sidebar */}
        <aside className="w-52 shrink-0 border-r border-border flex flex-col bg-muted/10 overflow-hidden">
          <div className="p-2.5 space-y-2 shrink-0 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search recipes…"
                value={sidebarSearch}
                onChange={e => setSidebarSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            {/* meal-type tabs */}
            <div className="grid grid-cols-4 gap-0.5 rounded-lg overflow-hidden border border-border">
              {(["all", "breakfast", "lunch", "dinner"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className={cn(
                    "py-1 text-[11px] font-medium transition-colors",
                    sidebarTab === tab
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                  title={tab === "all" ? "All" : tab}
                >
                  {tab === "all" ? "All" : MEAL_ICONS[tab]}
                </button>
              ))}
            </div>
          </div>

          <div className="px-1.5 pt-1 pb-0.5 shrink-0">
            <p className="text-[10px] text-muted-foreground px-1 flex items-center gap-1">
              <GripVertical className="h-2.5 w-2.5" /> Drag onto a day slot
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {sidebarRecipes.map(recipe => (
              <SidebarRecipeCard key={recipe.id} recipe={recipe} />
            ))}
            {sidebarRecipes.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-10 px-3">No recipes match</p>
            )}
          </div>
        </aside>

        {/* Planner grid */}
        <div className="flex-1 overflow-auto p-3">
          {isLoading ? (
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 14 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2" style={{ minWidth: 560 }}>
              {DAYS.map((day, dayIdx) => (
                <div key={day} className="flex flex-col gap-1.5">
                  {/* day header */}
                  <div className="text-center mb-0.5">
                    <div className="text-xs font-semibold">{DAY_LABELS[day]}</div>
                    <div className="text-[10px] text-muted-foreground">{formatShortDate(monday, dayIdx)}</div>
                  </div>

                  {mealSlots.map(mt => (
                    <MealSlot
                      key={mt}
                      mealTime={mt}
                      slotKey={`${day}_${mt}`}
                      recipeId={currentMeals[`${day}_${mt}` as MealSlotKey] ?? null}
                      recipes={recipes ?? []}
                      onSet={id => setSlot(day, mt, id)}
                      onClear={() => setSlot(day, mt, null)}
                      isPending={savePlan.isPending}
                      isDragOver={dragOver === `${day}_${mt}`}
                      onDragOver={e => { e.preventDefault(); setDragOver(`${day}_${mt}`); }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={e => onDrop(day, mt, e)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* bottom bar */}
      {plannedCount > 0 && (
        <div className="px-4 py-2 border-t border-border bg-background flex items-center justify-between shrink-0">
          <p className="text-xs text-muted-foreground">
            {plannedCount} meal{plannedCount !== 1 ? "s" : ""} planned
            {plannedCount < 8 && ` · ${8 - plannedCount} more to reach target`}
            {plannedCount >= 8 && " · Target reached! 🎉"}
          </p>
          <Button variant="ghost" size="sm" onClick={() => savePlan.mutate({})} data-testid="button-clear-plan">
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── SidebarRecipeCard ─────────────────────────────────────────────────────────

function SidebarRecipeCard({ recipe }: { recipe: Recipe }) {
  const emoji    = getFoodEmoji(recipe.name, recipe.cuisine);
  const gradient = getCuisineGradient(recipe.cuisine);
  const [imgErr, setImgErr] = useState(false);
  const hasImage = recipe.imageUrl && !imgErr;
  const totalTime = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData("recipeId", recipe.id.toString());
        e.dataTransfer.effectAllowed = "copy";
      }}
      className="group flex items-center gap-2 rounded-lg p-1.5 bg-card border border-border/60
                 cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-sm
                 transition-all select-none"
      title={recipe.name}
    >
      {/* thumbnail */}
      <div className="w-10 h-10 rounded-md overflow-hidden shrink-0 relative">
        {hasImage ? (
          <img src={recipe.imageUrl!} alt="" className="w-full h-full object-cover" onError={() => setImgErr(true)} />
        ) : (
          <div className={cn("w-full h-full bg-gradient-to-br flex items-center justify-center text-lg", gradient)}>
            {emoji}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium leading-tight truncate">{recipe.name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className={cn(
            "inline-flex rounded-full px-1.5 py-px text-[9px] font-medium capitalize",
            CUISINE_COLORS[recipe.cuisine] ?? CUISINE_COLORS["other"]
          )}>
            {recipe.cuisine}
          </span>
          {totalTime > 0 && (
            <span className="text-[9px] text-muted-foreground">{formatTime(totalTime)}</span>
          )}
        </div>
      </div>

      <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground/70 transition-colors" />
    </div>
  );
}

// ─── MealSlot ─────────────────────────────────────────────────────────────────

interface MealSlotProps {
  mealTime: MealTime;
  slotKey: string;
  recipeId: number | null;
  recipes: Recipe[];
  onSet: (id: number) => void;
  onClear: () => void;
  isPending: boolean;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

function MealSlot({
  mealTime, slotKey, recipeId, recipes,
  onSet, onClear, isPending,
  isDragOver, onDragOver, onDragLeave, onDrop,
}: MealSlotProps) {
  const [open, setOpen] = useState(false);
  const recipe    = recipeId != null ? recipes.find(r => r.id === recipeId) : null;
  const emoji     = recipe ? getFoodEmoji(recipe.name, recipe.cuisine) : null;
  const gradient  = recipe ? getCuisineGradient(recipe.cuisine) : null;
  const totalTime = recipe ? (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0) : 0;
  const [imgErr, setImgErr] = useState(false);
  const hasImage  = recipe?.imageUrl && !imgErr;

  const dropProps = { onDragOver, onDragLeave, onDrop };

  if (recipe) {
    return (
      <div
        {...dropProps}
        className={cn(
          "relative group rounded-lg overflow-hidden border text-xs min-h-[80px] flex flex-col transition-all",
          isDragOver ? "border-primary ring-1 ring-primary" : "border-border",
        )}
        data-testid={`slot-filled-${slotKey}`}
      >
        {/* image / gradient banner */}
        <div className="relative h-10 shrink-0">
          {hasImage ? (
            <img src={recipe.imageUrl!} alt="" className="w-full h-full object-cover" onError={() => setImgErr(true)} />
          ) : (
            <div className={cn("w-full h-full bg-gradient-to-r flex items-center justify-center text-base", gradient)}>
              {emoji}
            </div>
          )}
          {/* meal-time chip */}
          <span className="absolute bottom-0.5 left-1 text-[9px] bg-black/40 text-white rounded px-1 py-px">
            {MEAL_ICONS[mealTime]} {mealTime}
          </span>
        </div>

        {/* info */}
        <div className="flex flex-col gap-0.5 p-1.5 flex-1 bg-card">
          <span className="font-medium text-[11px] leading-snug line-clamp-2">{recipe.name}</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn(
              "inline-flex rounded-full px-1.5 py-px text-[9px] font-medium capitalize",
              CUISINE_COLORS[recipe.cuisine] ?? CUISINE_COLORS["other"]
            )}>{recipe.cuisine}</span>
            {totalTime > 0 && <span className="text-[9px] text-muted-foreground">{formatTime(totalTime)}</span>}
          </div>
        </div>

        {/* clear button */}
        <button
          onClick={onClear}
          disabled={isPending}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity
                     bg-black/40 hover:bg-black/60 rounded-full p-0.5"
          aria-label="Remove"
          data-testid={`button-clear-slot-${slotKey}`}
        >
          <X className="h-3 w-3 text-white" />
        </button>
      </div>
    );
  }

  // empty slot — droppable + click-to-search
  return (
    <div
      {...dropProps}
      className={cn(
        "rounded-lg border-2 border-dashed text-xs min-h-[80px] flex flex-col items-center justify-center gap-1 transition-all",
        isDragOver
          ? "border-primary bg-primary/5 scale-[1.02]"
          : "border-border/60 hover:border-muted-foreground/40 bg-muted/20"
      )}
      data-testid={`slot-empty-${slotKey}`}
    >
      <span className="text-xl leading-none">{MEAL_ICONS[mealTime]}</span>
      <span className="text-[10px] text-muted-foreground capitalize">{mealTime}</span>

      {isDragOver ? (
        <span className="text-[10px] text-primary font-medium animate-pulse">Drop here</span>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              className="text-[10px] text-primary/70 hover:text-primary underline-offset-2 hover:underline transition-colors"
              disabled={isPending}
              data-testid={`slot-pick-${slotKey}`}
            >
              + pick recipe
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-72" align="start" side="right">
            <Command>
              <CommandInput placeholder="Search recipes…" data-testid={`input-search-slot-${slotKey}`} />
              <CommandEmpty>No recipes found.</CommandEmpty>
              <CommandGroup className="max-h-72 overflow-auto">
                {recipes.map(r => {
                  const em = getFoodEmoji(r.name, r.cuisine);
                  const t  = (r.prepTime ?? 0) + (r.cookTime ?? 0);
                  return (
                    <CommandItem
                      key={r.id}
                      value={r.name}
                      onSelect={() => { onSet(r.id); setOpen(false); }}
                      className="flex items-center gap-2 cursor-pointer py-2"
                      data-testid={`option-recipe-${r.id}`}
                    >
                      <span className="text-base shrink-0">{em}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{r.name}</p>
                        <div className="flex gap-1.5 mt-0.5">
                          <span className={cn(
                            "inline-flex rounded-full px-1.5 text-[10px] font-medium capitalize",
                            CUISINE_COLORS[r.cuisine] ?? CUISINE_COLORS["other"]
                          )}>{r.cuisine}</span>
                          {t > 0 && <span className="text-[10px] text-muted-foreground">{formatTime(t)}</span>}
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

