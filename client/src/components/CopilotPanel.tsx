import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles, X, Check, Plus, Loader2, Clock, Users,
  ExternalLink, RefreshCw, Calendar, Search,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useLocation } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpoonacularRecipe {
  id: number;
  title: string;
  imageUrl: string;
  sourceUrl: string;
  readyInMinutes: number;
  servings: number;
  summary: string;
  cuisines: string[];
  dishTypes: string[];
  diets: string[];
  ingredients: { name: string; amount: number; unit: string; original: string }[];
  instructions: string[];
}

// ─── Filter chip definitions ──────────────────────────────────────────────────

const CUISINE_CHIPS: { label: string; value: string | null }[] = [
  { label: "All",              value: null },
  { label: "🍔 American",     value: "american" },
  { label: "🍝 Italian",      value: "italian" },
  { label: "🌮 Mexican",      value: "tex-mex" },
  { label: "🍜 Asian",        value: "asian" },
  { label: "🥗 Mediterranean",value: "mediterranean" },
  { label: "🍛 Indian",       value: "indian" },
  { label: "🍣 Japanese",     value: "japanese" },
  { label: "🥩 Korean",       value: "korean" },
  { label: "🥐 French",       value: "french" },
  { label: "🎲 Surprise",     value: "surprise" },
];

const MEAL_TYPE_CHIPS: { label: string; value: string | null }[] = [
  { label: "🍽️ Any",         value: null },
  { label: "🌙 Dinner",       value: "dinner" },
  { label: "☀️ Lunch",        value: "lunch" },
  { label: "🌅 Breakfast",    value: "breakfast" },
  { label: "🥗 Side Dish",    value: "side dish" },
];

const TIME_CHIPS: { label: string; value: number | null }[] = [
  { label: "⏱️ Any time",    value: null },
  { label: "⚡ Under 30 min", value: 30 },
  { label: "🕐 Under 45 min", value: 45 },
  { label: "🕑 Under 1 hour", value: 60 },
];

const DIET_CHIPS: { label: string; value: string | null }[] = [
  { label: "🥦 Vegetarian",   value: "vegetarian" },
  { label: "🌱 Vegan",        value: "vegan" },
  { label: "🚫🌾 Gluten-Free", value: "gluten free" },
  { label: "🥛 Dairy-Free",   value: "dairy free" },
  { label: "💪 High Protein", value: "high protein" },
  { label: "🫀 Heart Healthy", value: "whole 30" },
];

const METHOD_CHIPS: { label: string; value: string | null; method: string }[] = [
  { label: "🍲 One Pot",         value: "one-pot",       method: "one pot" },
  { label: "🥘 Slow Cooker",     value: "slow-cooker",   method: "slow cooker" },
  { label: "🌬️ Air Fryer",      value: "air-fryer",     method: "air fryer" },
  { label: "🔥 Grilled",         value: "grilled",       method: "grilled" },
  { label: "📦 Meal Prep",       value: "meal-prep",     method: "meal prep" },
  { label: "❄️ Freezer Friendly",value: "freezer",       method: "freezer friendly" },
];

// ─── Result card ─────────────────────────────────────────────────────────────

const DIET_BADGE_MAP: Record<string, string> = {
  vegetarian: "🥦 Veg",
  vegan: "🌱 Vegan",
  "gluten free": "🌾 GF",
  "dairy free": "🥛 DF",
};

interface ResultCardProps {
  recipe: SpoonacularRecipe;
  isSaved: boolean;
  isSaving: boolean;
  onSave: () => void;
  onAddToPlan: () => void;
}

function ResultCard({ recipe, isSaved, isSaving, onSave, onAddToPlan }: ResultCardProps) {
  const [imgError, setImgError] = useState(false);
  const cuisine = recipe.cuisines?.[0] || '';
  const dishType = recipe.dishTypes?.[0] || '';
  const isQuick = recipe.readyInMinutes > 0 && recipe.readyInMinutes <= 30;

  // Diet badges — first 2 only to keep cards compact
  const dietBadges = (recipe.diets || [])
    .filter(d => DIET_BADGE_MAP[d])
    .slice(0, 2);

  // Method badge — check dishTypes for one-pot, etc.
  const methodBadge =
    recipe.dishTypes?.find(dt => ['one pot meal', 'one-pot meal'].includes(dt.toLowerCase()))
      ? '🍲 One Pot'
      : recipe.title.toLowerCase().includes('air fryer') ? '🌬️ Air Fryer'
      : recipe.title.toLowerCase().includes('slow cooker') || recipe.title.toLowerCase().includes('crockpot') ? '🥘 Slow Cooker'
      : null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden hover:border-border/60 transition-colors">
      {/* Image */}
      <div className="relative h-36 bg-muted overflow-hidden">
        {recipe.imageUrl && !imgError ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-900/20 to-amber-900/20">
            <span className="text-4xl">🍽️</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        {/* Quick badge */}
        {isQuick && (
          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white">
            ⚡ Quick
          </span>
        )}
        {recipe.sourceUrl && (
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 right-2 flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <p className="font-bold text-white text-sm leading-tight line-clamp-2">{recipe.title}</p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border text-xs flex-wrap">
        {cuisine && (
          <span className="capitalize px-1.5 py-0.5 rounded-full bg-muted font-medium text-foreground/80">{cuisine}</span>
        )}
        {dishType && dishType.toLowerCase() !== cuisine.toLowerCase() && (
          <span className="capitalize px-1.5 py-0.5 rounded-full bg-muted text-foreground/60">{dishType}</span>
        )}
        {dietBadges.map(d => (
          <span key={d} className="px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 font-medium">
            {DIET_BADGE_MAP[d]}
          </span>
        ))}
        {methodBadge && (
          <span className="px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">{methodBadge}</span>
        )}
        <span className="flex items-center gap-1 ml-auto text-muted-foreground">
          <Clock className="h-3 w-3" />{recipe.readyInMinutes} min
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Users className="h-3 w-3" />{recipe.servings}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-3 py-2.5">
        {isSaved ? (
          <div className="flex-1 flex items-center justify-center gap-1.5 h-8 text-xs text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20 rounded-md font-medium">
            <Check className="h-3.5 w-3.5" /> Saved
          </div>
        ) : (
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            className="flex-1 h-8 text-xs gap-1 bg-[#C96A3A] hover:bg-[#A85530] text-white"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Save
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={onAddToPlan}
          className="flex-1 h-8 text-xs gap-1"
        >
          <Calendar className="h-3.5 w-3.5" />
          Add to Plan
        </Button>
      </div>
    </div>
  );
}

// ─── Chip button ─────────────────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
        active
          ? "bg-[#C96A3A] border-[#C96A3A] text-white shadow-sm"
          : "border-border hover:border-[#C96A3A]/50 hover:bg-muted/60 text-muted-foreground"
      )}
    >
      {label}
    </button>
  );
}

// ─── Chip row ─────────────────────────────────────────────────────────────────

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
      <div className="h-36 bg-muted" />
      <div className="px-3 py-1.5 border-b border-border flex gap-2">
        <div className="h-4 w-16 bg-muted rounded-full" />
        <div className="h-4 w-10 bg-muted rounded-full ml-auto" />
      </div>
      <div className="px-3 py-2.5 flex gap-2">
        <div className="flex-1 h-8 bg-muted rounded-md" />
        <div className="flex-1 h-8 bg-muted rounded-md" />
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface CopilotPanelProps {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

export function CopilotPanel({ open: controlledOpen, onOpenChange }: CopilotPanelProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

  // Filter state
  const [query, setQuery] = useState("");
  const [cuisineFilter, setCuisineFilter] = useState<string | null>(null);
  const [mealTypeFilter, setMealTypeFilter] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<number | null>(null);
  const [dietFilter, setDietFilter] = useState<string | null>(null);
  const [methodFilter, setMethodFilter] = useState<string | null>(null);

  // Results state
  const [recipes, setRecipes] = useState<SpoonacularRecipe[]>([]);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [savingId, setSavingId] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryRef = useRef("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Lock body scroll when panel is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => searchInputRef.current?.focus(), 150);
  }, [open]);

  const searchMutation = useMutation({
    mutationFn: () => {
      const methodChip = METHOD_CHIPS.find(m => m.value === methodFilter);
      return apiRequest("POST", "/api/ai/copilot/find-recipes", {
        query: queryRef.current.trim() || undefined,
        cuisineChoice: cuisineFilter ?? undefined,
        mealType: mealTypeFilter ?? undefined,
        maxReadyTime: timeFilter ?? undefined,
        diet: dietFilter ?? undefined,
        method: methodChip?.method ?? undefined,
      }).then(r => r.json());
    },
    onSuccess: (data) => {
      setRecipes(data.recipes || []);
      setHasSearched(true);
    },
    onError: (err: any) => {
      try {
        const jsonStart = err.message.indexOf("{");
        if (jsonStart !== -1) {
          const parsed = JSON.parse(err.message.slice(jsonStart));
          if (parsed.upgradePrompt) { setUpgradeReason(parsed.error); setUpgradeOpen(true); return; }
        }
      } catch {}
      toast({ title: "Couldn't find recipes", description: err.message, variant: "destructive" });
    },
  });

  const triggerSearch = useCallback(() => {
    const hasAny = queryRef.current.trim() || cuisineFilter || mealTypeFilter || timeFilter !== null || dietFilter || methodFilter;
    if (hasAny) searchMutation.mutate();
  }, [cuisineFilter, mealTypeFilter, timeFilter, dietFilter, methodFilter]); // eslint-disable-line

  // Auto-search when any chip changes (immediate)
  useEffect(() => {
    const hasAny = cuisineFilter || mealTypeFilter || timeFilter !== undefined || dietFilter || methodFilter;
    if (hasAny || hasSearched) triggerSearch();
  }, [cuisineFilter, mealTypeFilter, timeFilter, dietFilter, methodFilter]); // eslint-disable-line

  // Debounced search when text query changes (600ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) return;
    debounceRef.current = setTimeout(() => triggerSearch(), 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]); // eslint-disable-line

  // Parse cuisine keyword from typed text and highlight the matching chip
  useEffect(() => {
    if (!query.trim()) return;
    const lower = query.toLowerCase();
    const CUISINE_KEYWORDS: Array<{ keyword: string; value: string }> = [
      { keyword: "american", value: "american" },
      { keyword: "italian", value: "italian" },
      { keyword: "mexican", value: "tex-mex" },
      { keyword: "tex-mex", value: "tex-mex" },
      { keyword: "asian", value: "asian" },
      { keyword: "mediterranean", value: "mediterranean" },
      { keyword: "indian", value: "indian" },
      { keyword: "japanese", value: "japanese" },
      { keyword: "korean", value: "korean" },
      { keyword: "french", value: "french" },
    ];
    const match = CUISINE_KEYWORDS.find(({ keyword }) => lower.includes(keyword));
    if (match) setCuisineFilter(match.value);
  }, [query]); // eslint-disable-line

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { if (debounceRef.current) clearTimeout(debounceRef.current); triggerSearch(); }
  }

  async function saveRecipe(recipe: SpoonacularRecipe) {
    setSavingId(recipe.id);
    try {
      const res = await apiRequest("POST", "/api/ai/copilot/save-recipe", { recipe });
      if (!res.ok) throw new Error("Save failed");
      setSavedIds(prev => new Set([...prev, recipe.id]));
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: `"${recipe.title}" saved!` });
    } catch {
      toast({ title: "Couldn't save recipe", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  }

  function addToPlan(recipe: SpoonacularRecipe) {
    saveRecipe(recipe).then(() => { handleClose(); setLocation("/planner"); });
  }

  function handleClose() {
    if (onOpenChange) onOpenChange(false); else setInternalOpen(false);
  }

  function reset() {
    queryRef.current = "";
    setQuery(""); setCuisineFilter(null); setMealTypeFilter(null);
    setTimeFilter(null); setDietFilter(null); setMethodFilter(null);
    setRecipes([]); setSavedIds(new Set()); setHasSearched(false);
  }

  const hasFilters = !!(query.trim() || cuisineFilter || mealTypeFilter || timeFilter || dietFilter || methodFilter);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed z-50 flex flex-col bg-background border border-border rounded-2xl shadow-2xl",
          "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          "w-[calc(100vw-2rem)] max-w-lg max-h-[90vh]",
          "transition-all duration-200 ease-out",
          open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
        data-testid="panel-copilot"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-gradient-to-r from-orange-600/10 to-amber-600/10">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#C96A3A] shadow-sm shrink-0">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Find Recipes</p>
              <p className="text-xs text-muted-foreground">Search real recipes by anything</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {hasFilters && (
              <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted">
                Clear all
              </button>
            )}
            <button onClick={handleClose} className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Filters area */}
        <div className="px-4 pt-3 pb-3 border-b border-border shrink-0 space-y-2.5 overflow-y-auto max-h-[45vh] scrollbar-thin">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={e => { queryRef.current = e.target.value; setQuery(e.target.value); }}
              onKeyDown={handleKeyDown}
              placeholder="Try: 'quick american dinners' or 'easy italian pasta'"
              className="w-full h-9 pl-9 pr-4 rounded-lg border border-border bg-muted text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-[#C96A3A]/50 focus:border-[#C96A3A]/50 transition-colors"
            />
          </div>

          {/* Cuisine */}
          <ChipRow label="Cuisine">
            {CUISINE_CHIPS.map(c => (
              <Chip key={String(c.value)} label={c.label} active={cuisineFilter === c.value} onClick={() => setCuisineFilter(c.value)} />
            ))}
          </ChipRow>

          {/* Meal Type */}
          <ChipRow label="Meal Type">
            {MEAL_TYPE_CHIPS.map(c => (
              <Chip key={String(c.value)} label={c.label} active={mealTypeFilter === c.value} onClick={() => setMealTypeFilter(c.value)} />
            ))}
          </ChipRow>

          {/* Cook Time */}
          <ChipRow label="Cook Time">
            {TIME_CHIPS.map(c => (
              <Chip key={String(c.value)} label={c.label} active={timeFilter === c.value} onClick={() => setTimeFilter(c.value)} />
            ))}
          </ChipRow>

          {/* Diet & Lifestyle */}
          <ChipRow label="Diet & Lifestyle">
            {DIET_CHIPS.map(c => (
              <Chip key={String(c.value)} label={c.label} active={dietFilter === c.value} onClick={() => setDietFilter(dietFilter === c.value ? null : c.value)} />
            ))}
          </ChipRow>

          {/* Cooking Method */}
          <ChipRow label="Cooking Method">
            {METHOD_CHIPS.map(c => (
              <Chip key={String(c.value)} label={c.label} active={methodFilter === c.value} onClick={() => setMethodFilter(methodFilter === c.value ? null : c.value)} />
            ))}
          </ChipRow>

          {/* Search button (secondary) */}
          <Button
            size="sm"
            onClick={() => { if (debounceRef.current) clearTimeout(debounceRef.current); triggerSearch(); }}
            disabled={searchMutation.isPending || !hasFilters}
            variant="outline"
            className="w-full h-8 gap-1.5 text-xs border-[#C96A3A]/40 text-[#C96A3A] hover:bg-[#C96A3A]/10"
          >
            {searchMutation.isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...</>
              : <><Search className="h-3.5 w-3.5" /> Search</>
            }
          </Button>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3 scrollbar-thin">

          {/* Loading skeletons */}
          {searchMutation.isPending && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* Empty state */}
          {!searchMutation.isPending && hasSearched && recipes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <span className="text-4xl">🤷</span>
              <div>
                <p className="text-sm font-medium text-foreground">No recipes found</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Try broader terms or clear some filters.
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={triggerSearch}>
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </Button>
            </div>
          )}

          {/* Intro state */}
          {!searchMutation.isPending && !hasSearched && (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/20">
                <Search className="h-6 w-6 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Search or pick filters above</p>
                <p className="text-xs text-muted-foreground mt-1">Chips trigger search automatically</p>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5 text-xs">
                {["quick american dinners", "easy italian pasta", "vegetarian healthy lunch", "air fryer chicken"].map(ex => (
                  <button
                    key={ex}
                    onClick={() => { queryRef.current = ex; setQuery(ex); if (debounceRef.current) clearTimeout(debounceRef.current); triggerSearch(); }}
                    className="px-2.5 py-1 rounded-full border border-border bg-muted hover:border-[#C96A3A]/50 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {!searchMutation.isPending && recipes.length > 0 && (
            <>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{recipes.length} recipe{recipes.length !== 1 ? 's' : ''}</span>
                <button onClick={triggerSearch} className="flex items-center gap-1 hover:text-foreground transition-colors">
                  <RefreshCw className="h-3 w-3" /> Refresh
                </button>
              </div>
              <div className="space-y-3">
                {recipes.map(recipe => (
                  <ResultCard
                    key={recipe.id}
                    recipe={recipe}
                    isSaved={savedIds.has(recipe.id)}
                    isSaving={savingId === recipe.id}
                    onSave={() => saveRecipe(recipe)}
                    onAddToPlan={() => addToPlan(recipe)}
                  />
                ))}
              </div>
              {savedIds.size > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                  <Calendar className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-muted-foreground text-xs">
                    Head to <strong className="text-foreground">Weekly Plan</strong> to schedule saved recipes.
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} reason={upgradeReason} />
    </>
  );
}
