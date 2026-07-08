import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles, X, Check, Plus, Loader2, Clock,
  ExternalLink, RefreshCw, Calendar, Search,
  // chip icons
  Wheat, Flame, Soup, Drumstick, Leaf, CookingPot, Fish, Beef, Croissant,
  Sunrise, Sun, Moon, UtensilsCrossed,
  Sprout, WheatOff, MilkOff, Dumbbell, Heart,
  Microwave, LayoutGrid, Snowflake, Zap,
  type LucideIcon,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useLocation } from "wouter";
import { RecipeImage } from "@/components/RecipeImage";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpoonacularRecipe {
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

// ─── Cuisine adapter ────────────────────────────────────────────────────────────
// Spoonacular returns raw cuisine strings (e.g. "Mexican", "Thai", "Greek").
// Map them onto the app's 7 cuisine keys so <RecipeImage> can render a
// cuisine-keyed placeholder when no photo exists. Anything unmatched → "other".

const SPOON_CUISINE_MAP: Record<string, string> = {
  // Italian
  italian: "italian",
  // Tex-Mex
  mexican: "tex-mex",
  // American
  american: "american",
  southern: "american",
  cajun: "american",
  creole: "american",
  "cajun creole": "american",
  bbq: "american",
  barbecue: "american",
  southwestern: "american",
  // Asian
  asian: "asian",
  chinese: "asian",
  japanese: "asian",
  korean: "asian",
  thai: "asian",
  vietnamese: "asian",
  // Mediterranean
  mediterranean: "mediterranean",
  greek: "mediterranean",
  spanish: "mediterranean",
  // Indian
  indian: "indian",
  // Note: "middle eastern" and "latin american" intentionally map to "other"
  // (neutral) for now so we don't mis-color — refine later if desired.
};

/** Pure: map a raw Spoonacular cuisine string to one of RecipeImage's 7 keys.
 *  Empty / unmatched (french, british, middle eastern, latin american, …) → "other". */
function mapCuisine(raw?: string): string {
  if (!raw) return "other";
  return SPOON_CUISINE_MAP[raw.trim().toLowerCase()] ?? "other";
}

/** Adapt a SpoonacularRecipe to the minimal shape <RecipeImage> needs. */
function toRecipeImageProps(r: SpoonacularRecipe) {
  return {
    name: r.title,
    imageUrl: r.imageUrl,
    cuisine: mapCuisine(r.cuisines?.[0]),
  };
}

// ─── Filter chip definitions ──────────────────────────────────────────────────

// Chips carry a lucide icon (rendered 12px, inline before the label) instead of
// an emoji. Cuisine icons mirror the <RecipeImage> placeholder glyphs.
const CUISINE_CHIPS: { label: string; value: string | null; icon?: LucideIcon }[] = [
  { label: "All",           value: null },
  { label: "American",      value: "american",      icon: Drumstick },
  { label: "Italian",       value: "italian",       icon: Wheat },
  { label: "Mexican",       value: "tex-mex",       icon: Flame },
  { label: "Asian",         value: "asian",         icon: Soup },
  { label: "Mediterranean", value: "mediterranean", icon: Leaf },
  { label: "Indian",        value: "indian",        icon: CookingPot },
  { label: "Japanese",      value: "japanese",      icon: Fish },
  { label: "Korean",        value: "korean",        icon: Beef },
  { label: "French",        value: "french",        icon: Croissant },
  { label: "Surprise",      value: "surprise",      icon: Sparkles },
];

const MEAL_TYPE_CHIPS: { label: string; value: string | null; icon?: LucideIcon }[] = [
  { label: "Any",       value: null },
  { label: "Dinner",    value: "dinner",    icon: Moon },
  { label: "Lunch",     value: "lunch",     icon: Sun },
  { label: "Breakfast", value: "breakfast", icon: Sunrise },
  { label: "Side Dish", value: "side dish", icon: UtensilsCrossed },
];

const TIME_CHIPS: { label: string; value: number | null; icon?: LucideIcon }[] = [
  { label: "Any time",     value: null },
  { label: "Under 30 min", value: 30, icon: Zap },
  { label: "Under 45 min", value: 45, icon: Clock },
  { label: "Under 1 hour", value: 60, icon: Clock },
];

const DIET_CHIPS: { label: string; value: string | null; icon?: LucideIcon }[] = [
  { label: "Vegetarian",    value: "vegetarian",   icon: Leaf },
  { label: "Vegan",         value: "vegan",        icon: Sprout },
  { label: "Gluten-Free",   value: "gluten free",  icon: WheatOff },
  { label: "Dairy-Free",    value: "dairy free",   icon: MilkOff },
  { label: "High Protein",  value: "high protein", icon: Dumbbell },
  { label: "Heart Healthy", value: "whole 30",     icon: Heart },
];

const METHOD_CHIPS: { label: string; value: string | null; method: string; icon?: LucideIcon }[] = [
  { label: "One Pot",          value: "one-pot",     method: "one pot",          icon: CookingPot },
  { label: "Slow Cooker",      value: "slow-cooker", method: "slow cooker",      icon: Clock },
  { label: "Air Fryer",        value: "air-fryer",   method: "air fryer",        icon: Microwave },
  { label: "Grilled",          value: "grilled",     method: "grilled",          icon: Flame },
  { label: "Meal Prep",        value: "meal-prep",   method: "meal prep",        icon: LayoutGrid },
  { label: "Freezer Friendly", value: "freezer",     method: "freezer friendly", icon: Snowflake },
];

const DIET_BADGE_MAP: Record<string, string> = {
  vegetarian: "🥦 Veg",
  vegan: "🌱 Vegan",
  "gluten free": "🌾 GF",
  "dairy free": "🥛 DF",
};

// ─── Result card (image-top) ────────────────────────────────────────────────────

interface ResultCardProps {
  recipe: SpoonacularRecipe;
  isSaved: boolean;
  isSaving: boolean;
  onSave: () => void;
  onAddToPlan: () => void;
}

function ResultCard({ recipe, isSaved, isSaving, onSave, onAddToPlan }: ResultCardProps) {
  const isQuick = recipe.readyInMinutes > 0 && recipe.readyInMinutes <= 30;

  // Diet badges — first 2 only to keep cards compact
  const dietBadges = (recipe.diets || [])
    .filter(d => DIET_BADGE_MAP[d])
    .slice(0, 2);

  // "time · serves N" meta line — cuisine is intentionally NOT shown (it still
  // drives the RecipeImage placeholder color via toRecipeImageProps/mapCuisine).
  const metaParts: string[] = [];
  if (recipe.readyInMinutes > 0) metaParts.push(`${recipe.readyInMinutes} min`);
  if (recipe.servings > 0) metaParts.push(`serves ${recipe.servings}`);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col hover:border-border/60 transition-colors">
      {/* Image banner */}
      <div className="relative h-36 shrink-0 overflow-hidden">
        <RecipeImage recipe={toRecipeImageProps(recipe)} size="md" showTitle={false} className="w-full h-full" />
        {/* Quick badge */}
        {isQuick && (
          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white shadow-sm">
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
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-3 gap-1.5">
        <p className="font-serif font-semibold text-foreground text-sm leading-snug line-clamp-2">
          {recipe.title}
        </p>

        {metaParts.length > 0 && (
          <p className="text-xs text-muted-foreground capitalize">{metaParts.join(" · ")}</p>
        )}

        {dietBadges.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {dietBadges.map(d => (
              <span key={d} className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 font-medium">
                {DIET_BADGE_MAP[d]}
              </span>
            ))}
          </div>
        )}

        {/* Actions — pinned to bottom, set apart from meta/badges with a divider + padding */}
        <div className="flex gap-2.5 mt-auto pt-3 border-t border-border/50">
          {isSaved ? (
            <div className="flex-1 flex items-center justify-center gap-1.5 h-9 text-xs text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20 rounded-md font-medium">
              <Check className="h-3.5 w-3.5" /> Saved
            </div>
          ) : (
            <Button
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              className="flex-1 h-9 text-xs gap-1.5 bg-[#C96A3A] hover:bg-[#A85530] text-white"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Save
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onAddToPlan}
            className="flex-1 h-9 text-xs gap-1.5"
          >
            <Calendar className="h-3.5 w-3.5" />
            Add to Plan
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Chip button ─────────────────────────────────────────────────────────────

function Chip({ label, active, onClick, icon: Icon }: { label: string; active: boolean; onClick: () => void; icon?: LucideIcon }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
        active
          ? "bg-[#C96A3A] border-[#C96A3A] text-white shadow-sm"
          : "border-border hover:border-[#C96A3A]/50 hover:bg-muted/60 text-muted-foreground"
      )}
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
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
      <div className="p-3 space-y-2">
        <div className="h-4 w-3/4 bg-muted rounded" />
        <div className="h-3 w-1/2 bg-muted rounded" />
        <div className="flex gap-2 pt-1">
          <div className="flex-1 h-8 bg-muted rounded-md" />
          <div className="flex-1 h-8 bg-muted rounded-md" />
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface FindRecipesPanelProps {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  /** Preview-only: seed result cards without hitting the search API. */
  previewRecipes?: SpoonacularRecipe[];
}

export function FindRecipesPanel({ open: controlledOpen, onOpenChange, previewRecipes }: FindRecipesPanelProps = {}) {
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
  const [recipes, setRecipes] = useState<SpoonacularRecipe[]>(previewRecipes ?? []);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [savingId, setSavingId] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(!!previewRecipes);
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

  // Filters block — shared between desktop left rail and mobile top section
  const filtersContent = (
    <div className="space-y-2.5">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={e => { queryRef.current = e.target.value; setQuery(e.target.value); }}
          onKeyDown={handleKeyDown}
          placeholder="Try: 'quick american dinners'"
          className="w-full h-9 pl-9 pr-4 rounded-lg border border-border bg-muted text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-[#C96A3A]/50 focus:border-[#C96A3A]/50 transition-colors"
        />
      </div>

      <ChipRow label="Cuisine">
        {CUISINE_CHIPS.map(c => (
          <Chip key={String(c.value)} label={c.label} icon={c.icon} active={cuisineFilter === c.value} onClick={() => setCuisineFilter(c.value)} />
        ))}
      </ChipRow>

      <ChipRow label="Meal Type">
        {MEAL_TYPE_CHIPS.map(c => (
          <Chip key={String(c.value)} label={c.label} icon={c.icon} active={mealTypeFilter === c.value} onClick={() => setMealTypeFilter(c.value)} />
        ))}
      </ChipRow>

      <ChipRow label="Cook Time">
        {TIME_CHIPS.map(c => (
          <Chip key={String(c.value)} label={c.label} icon={c.icon} active={timeFilter === c.value} onClick={() => setTimeFilter(c.value)} />
        ))}
      </ChipRow>

      <ChipRow label="Diet & Lifestyle">
        {DIET_CHIPS.map(c => (
          <Chip key={String(c.value)} label={c.label} icon={c.icon} active={dietFilter === c.value} onClick={() => setDietFilter(dietFilter === c.value ? null : c.value)} />
        ))}
      </ChipRow>

      <ChipRow label="Cooking Method">
        {METHOD_CHIPS.map(c => (
          <Chip key={String(c.value)} label={c.label} icon={c.icon} active={methodFilter === c.value} onClick={() => setMethodFilter(methodFilter === c.value ? null : c.value)} />
        ))}
      </ChipRow>

      {/* Search button — needed for the text input + as the mobile affordance */}
      <Button
        size="sm"
        onClick={() => { if (debounceRef.current) clearTimeout(debounceRef.current); triggerSearch(); }}
        disabled={searchMutation.isPending || !hasFilters}
        className="w-full h-9 gap-1.5 text-xs bg-[#C96A3A] hover:bg-[#A85530] text-white"
      >
        {searchMutation.isPending
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...</>
          : <><Search className="h-3.5 w-3.5" /> Search</>
        }
      </Button>
    </div>
  );

  // Results block — shared between desktop right column and mobile lower section
  const resultsContent = (
    <>
      {/* Loading skeletons */}
      {searchMutation.isPending && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
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
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/20">
            <Search className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Search or pick filters</p>
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

      {/* Results grid */}
      {!searchMutation.isPending && recipes.length > 0 && (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
            <span>{recipes.length} recipe{recipes.length !== 1 ? 's' : ''}</span>
            <button onClick={triggerSearch} className="flex items-center gap-1 hover:text-foreground transition-colors">
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            <div className="flex items-center gap-3 p-3 mt-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <Calendar className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-muted-foreground text-xs">
                Head to <strong className="text-foreground">Weekly Plan</strong> to schedule saved recipes.
              </span>
            </div>
          )}
        </>
      )}
    </>
  );

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

      {/* Panel — bottom sheet on mobile, centered modal on desktop */}
      <div
        className={cn(
          "fixed z-50 flex flex-col bg-background shadow-2xl transition-all duration-300 ease-out",
          // mobile: bottom sheet
          "inset-x-0 bottom-0 rounded-t-2xl max-h-[85vh]",
          // desktop: centered wide modal
          "md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2",
          "md:h-[85vh] md:w-[calc(100vw-4rem)] md:max-w-4xl md:rounded-2xl md:border md:border-border",
          open
            ? "translate-y-0 md:-translate-y-1/2 opacity-100 md:scale-100"
            : "translate-y-full md:-translate-y-1/2 opacity-0 md:scale-95 pointer-events-none"
        )}
        data-testid="panel-find-recipes"
      >
        {/* Drag handle — mobile only */}
        <div className="md:hidden flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

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

        {/* Body:
            - mobile: single unified vertical scroll (filters then results)
            - desktop: two columns, left rail + right results, each scrolls independently */}
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto md:flex-row md:overflow-hidden scrollbar-thin">
          {/* Filters — left rail (desktop) / top section (mobile) */}
          <div className="px-4 py-3 border-b border-border md:border-b-0 md:border-r md:w-[240px] md:shrink-0 md:overflow-y-auto scrollbar-thin">
            {filtersContent}
          </div>

          {/* Results — right column (desktop) / lower section (mobile) */}
          <div className="px-4 py-3 md:flex-1 md:overflow-y-auto scrollbar-thin">
            {resultsContent}
          </div>
        </div>
      </div>

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} reason={upgradeReason} />
    </>
  );
}
