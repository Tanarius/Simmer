import { useState, useEffect, useMemo, useRef } from "react";
import {
  Sparkles, X, ChevronLeft, ChevronRight, Check, Plus,
  Loader2, Clock, AlertTriangle, ExternalLink, Users, RefreshCw, Calendar,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getIngredientChipClass } from "@/lib/ingredientCategories";
import { UpgradeModal } from "@/components/UpgradeModal";

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

// ─── Question options ──────────────────────────────────────────────────────────

const MEAL_TYPES = [
  { label: "Breakfast", emoji: "🌅", value: "breakfast" },
  { label: "Lunch",     emoji: "🥗", value: "lunch" },
  { label: "Dinner",    emoji: "🍽️", value: "dinner" },
  { label: "Snack",     emoji: "🍿", value: "snack" },
];

const CUISINES = [
  { label: "Italian",       emoji: "🍝", value: "italian" },
  { label: "Asian",         emoji: "🍜", value: "asian" },
  { label: "Tex-Mex",      emoji: "🌮", value: "tex-mex" },
  { label: "American",     emoji: "🍔", value: "american" },
  { label: "Indian",       emoji: "🍛", value: "indian" },
  { label: "Mediterranean",emoji: "🫒", value: "mediterranean" },
  { label: "Japanese",     emoji: "🍣", value: "japanese" },
  { label: "Korean",       emoji: "🌶️", value: "korean" },
  { label: "Middle Eastern",emoji: "🧆", value: "middle-eastern" },
  { label: "French",       emoji: "🥐", value: "french" },
  { label: "Caribbean",    emoji: "🌴", value: "caribbean" },
  { label: "Surprise me",  emoji: "🎲", value: "surprise" },
];

const VIBES = [
  { label: "Quick & easy",   emoji: "⚡",  value: "quick meal" },
  { label: "Healthy",        emoji: "🥦",  value: "healthy" },
  { label: "Comfort food",   emoji: "🍲",  value: "comfort food" },
  { label: "Something new",  emoji: "🌍",  value: "adventurous" },
  { label: "Crockpot",       emoji: "🫕",  value: "crockpot" },
  { label: "Air Fryer",      emoji: "🌬️", value: "air fryer" },
  { label: "Meal Prep",      emoji: "📦",  value: "meal prep" },
];

const PROTEINS = [
  { label: "Chicken",     emoji: "🍗", value: "chicken" },
  { label: "Beef",        emoji: "🥩", value: "beef" },
  { label: "Fish",        emoji: "🐟", value: "fish" },
  { label: "Pork",        emoji: "🐷", value: "pork" },
  { label: "Vegetarian",  emoji: "🥦", value: "vegetarian" },
  { label: "Sides",       emoji: "🥗", value: "sides" },
];


// ─── Recipe Card ──────────────────────────────────────────────────────────────

interface RecipeCardProps {
  recipe: SpoonacularRecipe;
  index: number;
  total: number;
  avoidedIngredients: string[];
  substitutions: Record<string, string | null>;
  onSave: () => void;
  onNext: () => void;
  onPrev: () => void;
  isSaving: boolean;
  isSaved: boolean;
}

function RecipeCard({
  recipe, index, total, avoidedIngredients, substitutions,
  onSave, onNext, onPrev, isSaving, isSaved,
}: RecipeCardProps) {
  const [imgError, setImgError] = useState(false);

  const flagged = recipe.ingredients.filter(i =>
    avoidedIngredients.some(a => i.name.toLowerCase().includes(a.toLowerCase()))
  );

  const cuisineLabel = recipe.cuisines?.[0] || recipe.dishTypes?.[0] || '';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Photo */}
      <div className="relative h-52 bg-muted overflow-hidden">
        {recipe.imageUrl && !imgError ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/20 dark:to-amber-900/20">
            <span className="text-5xl">🍽️</span>
          </div>
        )}
        {/* Gradient overlay + title */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent flex items-end p-3 gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-base leading-tight">{recipe.title}</p>
            {cuisineLabel && (
              <p className="text-white/60 text-xs mt-0.5 capitalize">{cuisineLabel}</p>
            )}
          </div>
          {recipe.sourceUrl && (
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white transition-colors"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
              Source
            </a>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 px-4 py-2.5 text-xs text-muted-foreground border-b border-border">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />{recipe.readyInMinutes} min
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />{recipe.servings} servings
        </span>
        {recipe.diets?.slice(0, 2).map((d: string) => (
          <span key={d} className="capitalize px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">{d}</span>
        ))}
      </div>

      {/* Flagged ingredients warning */}
      {flagged.length > 0 && (
        <div className="px-4 py-2.5 border-b border-border bg-amber-500/5">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1 mb-1">
            <AlertTriangle className="h-3 w-3" /> Contains avoided ingredients
          </p>
          {flagged.map(i => {
            const avoidedKey = avoidedIngredients.find(a => i.name.toLowerCase().includes(a.toLowerCase()))!;
            const sub = substitutions[avoidedKey];
            return (
              <p key={i.name} className="text-xs text-foreground/80">
                <span className="font-medium text-amber-600 dark:text-amber-400">{i.name}</span>
                {sub && <span className="text-muted-foreground"> → sub: <span className="font-medium text-foreground">{sub}</span></span>}
              </p>
            );
          })}
        </div>
      )}

      {/* Ingredient chips */}
      {recipe.ingredients.length > 0 && (
        <div className="px-4 py-2.5 border-b border-border">
          <div className="flex flex-wrap gap-1.5">
            {recipe.ingredients.slice(0, 10).map((ing, i) => {
              const isAvoided = avoidedIngredients.some(a => ing.name.toLowerCase().includes(a.toLowerCase()));
              return (
                <span
                  key={i}
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full capitalize font-medium",
                    isAvoided
                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40"
                      : getIngredientChipClass(ing.name)
                  )}
                >
                  {ing.name}
                </span>
              );
            })}
            {recipe.ingredients.length > 10 && (
              <span className="text-xs text-muted-foreground self-center">+{recipe.ingredients.length - 10} more</span>
            )}
          </div>
        </div>
      )}

      {/* Navigation + Save */}
      <div className="flex items-center gap-2 px-4 py-3">
        <Button
          size="sm"
          variant="outline"
          className="h-9 w-9 p-0 shrink-0"
          onClick={onPrev}
          disabled={index === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {isSaved ? (
          <div className="flex-1 flex items-center justify-center gap-2 h-9 text-sm text-green-600 dark:text-green-400 bg-green-500/10 border border-green-500/20 rounded-md">
            <Check className="h-4 w-4" /> Saved!
          </div>
        ) : (
          <Button
            size="sm"
            className="flex-1 h-9 text-sm gap-1.5"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Save to Library
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          className="h-9 w-9 p-0 shrink-0"
          onClick={onNext}
          disabled={index === total - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Option button ─────────────────────────────────────────────────────────────

function OptionButton({
  selected, disabled, onClick, children, className,
}: {
  selected: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left w-full",
        selected
          ? "border-primary bg-primary/10 text-primary shadow-sm"
          : "border-border hover:border-primary/40 hover:bg-muted/60",
        className
      )}
    >
      {children}
      {selected && <Check className="h-3.5 w-3.5 ml-auto shrink-0 text-primary" />}
    </button>
  );
}

function SectionLabel({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
        {step}
      </span>
      <p className="text-sm font-semibold text-foreground">{children}</p>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface CopilotPanelProps {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

export function CopilotPanel({ open: controlledOpen, onOpenChange }: CopilotPanelProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mealType, setMealType] = useState<string | null>(null);
  const [cuisineChoice, setCuisineChoice] = useState<string | null>(null);
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null);
  const [protein, setProtein] = useState<string | null>(null);

  const [recipes, setRecipes] = useState<SpoonacularRecipe[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [savingId, setSavingId] = useState<number | null>(null);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>();

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Prevent body scroll when panel is open on mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const { data: tasteProfile } = useQuery<any>({
    queryKey: ["/api/taste-profile"],
    enabled: open,
  });

  // Derive user's dominant cuisines from saved recipes (already in cache)
  const { data: savedRecipes } = useQuery<any[]>({
    queryKey: ["/api/recipes"],
    enabled: open,
  });
  const dominantCuisines = useMemo(() => {
    if (!savedRecipes?.length) return new Set<string>();
    const counts: Record<string, number> = {};
    for (const r of savedRecipes) {
      const c = (r.cuisine || r.cuisineType || '').toLowerCase();
      if (c) counts[c] = (counts[c] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return new Set(sorted.slice(0, 3).map(([c]) => c));
  }, [savedRecipes]);

  const avoidedIngredients: string[] = tasteProfile?.dislikedIngredients || [];
  const substitutions: Record<string, string | null> = (tasteProfile?.ingredientSubstitutions as any) || {};

  // All 3 questions answered
  const readyToSearch = mealType !== null && cuisineChoice !== null && selectedVibe !== null;

  const searchMutation = useMutation({
    mutationFn: (attempt: number) =>
      apiRequest("POST", "/api/ai/copilot/find-recipes", {
        cuisineChoice,
        vibe: selectedVibe,
        mealType,
        protein,
        attempt,
      }).then(r => r.json()),
    onSuccess: (data) => {
      setRecipes(data.recipes || []);
      setCurrentIdx(0);
    },
    onError: (err: any) => {
      // Check for rate-limit 429 with upgradePrompt flag
      try {
        const jsonStart = err.message.indexOf("{");
        if (jsonStart !== -1) {
          const parsed = JSON.parse(err.message.slice(jsonStart));
          if (parsed.upgradePrompt) {
            setUpgradeReason(parsed.error);
            setUpgradeOpen(true);
            return;
          }
        }
      } catch {}
      toast({ title: "Couldn't find recipes", description: err.message, variant: "destructive" });
    },
  });

  async function saveRecipe(recipe: SpoonacularRecipe) {
    setSavingId(recipe.id);
    try {
      const res = await apiRequest("POST", "/api/ai/copilot/save-recipe", { recipe });
      if (!res.ok) throw new Error("Save failed");
      setSavedIds(prev => new Set([...prev, recipe.id]));
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: `"${recipe.title}" saved to your library!` });
    } catch {
      toast({ title: "Couldn't save recipe", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  }

  function handleSearch() {
    searchMutation.mutate(searchAttempt);
  }

  function handleFindMore() {
    const next = searchAttempt + 1;
    setSearchAttempt(next);
    searchMutation.mutate(next);
  }

  function reset() {
    setMealType(null);
    setCuisineChoice(null);
    setSelectedVibe(null);
    setProtein(null);
    setRecipes([]);
    setCurrentIdx(0);
    setSavedIds(new Set());
    setSearchAttempt(0);
  }

  function handleClose() {
    if (onOpenChange) onOpenChange(false);
    else setInternalOpen(false);
  }

  const currentRecipe = recipes[currentIdx] ?? null;
  const hasSaved = savedIds.size > 0;
  const hasResults = recipes.length > 0;

  // Auto-scroll to bottom whenever a new step or result appears
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mealType, cuisineChoice, selectedVibe, protein, hasResults, searchMutation.isPending]);

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

      {/* Centered modal */}
      <div
        className={cn(
          "fixed z-50 flex flex-col bg-background border border-border rounded-2xl shadow-2xl",
          "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          "w-[calc(100vw-2rem)] max-w-lg max-h-[85vh]",
          "transition-all duration-200 ease-out",
          open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
        data-testid="panel-copilot"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0 bg-gradient-to-r from-violet-600/10 to-indigo-600/10">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-sm">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Kitchen Copilot</p>
              <p className="text-xs text-muted-foreground">Find your next meal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(mealType || hasResults) && (
              <button
                onClick={reset}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
              >
                Start over
              </button>
            )}
            <button
              onClick={handleClose}
              className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* When results are loaded: show compact summary row instead of full question UI */}
          {hasResults ? (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-muted-foreground">Searching:</span>
              {[
                MEAL_TYPES.find(m => m.value === mealType),
                CUISINES.find(c => c.value === cuisineChoice),
                VIBES.find(v => v.value === selectedVibe),
                protein ? PROTEINS.find(p => p.value === protein) : null,
              ].filter(Boolean).map(opt => opt && (
                <span key={opt.value} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                  {opt.emoji} {opt.label}
                </span>
              ))}
            </div>
          ) : (
            <>
              {/* Q1: Meal type */}
              <div>
                <SectionLabel step={1}>What meal is this for?</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  {MEAL_TYPES.map(opt => (
                    <OptionButton
                      key={opt.value}
                      selected={mealType === opt.value}
                      disabled={searchMutation.isPending}
                      onClick={() => { setMealType(opt.value); setRecipes([]); setSearchAttempt(0); }}
                    >
                      <span className="text-xl leading-none">{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </OptionButton>
                  ))}
                </div>
              </div>

              {/* Q2: Cuisine */}
              {mealType && (
                <div>
                  <SectionLabel step={2}>Any cuisine calling your name?</SectionLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {CUISINES.map(c => {
                      const isYourStyle = dominantCuisines.has(c.value);
                      return (
                        <OptionButton
                          key={c.value}
                          selected={cuisineChoice === c.value}
                          disabled={searchMutation.isPending}
                          onClick={() => { setCuisineChoice(c.value); setRecipes([]); setSearchAttempt(0); }}
                          className="flex-col items-center justify-center text-center py-3 gap-1 relative"
                        >
                          {isYourStyle && (
                            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-violet-500" title="Matches your taste" />
                          )}
                          <span className="text-2xl leading-none">{c.emoji}</span>
                          <span className="text-xs leading-tight">{c.label}</span>
                        </OptionButton>
                      );
                    })}
                  </div>
                  {dominantCuisines.size > 0 && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                      Matches your saved recipe history
                    </p>
                  )}
                </div>
              )}

              {/* Q3: Vibe */}
              {cuisineChoice && (
                <div>
                  <SectionLabel step={3}>What's the vibe?</SectionLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {VIBES.map(v => (
                      <OptionButton
                        key={v.value}
                        selected={selectedVibe === v.value}
                        disabled={searchMutation.isPending}
                        onClick={() => { setSelectedVibe(v.value); setRecipes([]); setSearchAttempt(0); }}
                      >
                        <span className="text-xl leading-none">{v.emoji}</span>
                        <span>{v.label}</span>
                      </OptionButton>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional: Protein / base selector */}
              {selectedVibe && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground text-xs font-bold shrink-0">4</span>
                    <p className="text-sm font-semibold text-foreground">
                      Main ingredient?
                      <span className="text-xs font-normal text-muted-foreground ml-1.5">optional</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PROTEINS.map(p => (
                      <button
                        key={p.value}
                        disabled={searchMutation.isPending}
                        onClick={() => {
                          setProtein(prev => prev === p.value ? null : p.value);
                          setRecipes([]);
                          setSearchAttempt(0);
                        }}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all",
                          protein === p.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/40 hover:bg-muted/60"
                        )}
                      >
                        <span className="text-base leading-none">{p.emoji}</span>
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Avoided ingredients note */}
          {readyToSearch && avoidedIngredients.length > 0 && !hasResults && !searchMutation.isPending && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
              <span>
                Filtering out{" "}
                {avoidedIngredients.map((ing, i) => (
                  <span key={ing}>
                    {i > 0 && ", "}
                    <span className="font-medium text-foreground">{ing}</span>
                    {substitutions[ing] && <span> (→ {substitutions[ing]})</span>}
                  </span>
                ))}
              </span>
            </div>
          )}

          {/* Search CTA */}
          {readyToSearch && !hasResults && !searchMutation.isPending && (
            <Button
              className="w-full h-12 text-sm gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-violet-500/25"
              onClick={handleSearch}
            >
              <Sparkles className="h-4 w-4" />
              Find real recipes
            </Button>
          )}

          {/* Loading state */}
          {searchMutation.isPending && (
            <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              <p>Searching real recipes...</p>
            </div>
          )}

          {/* Empty state */}
          {!searchMutation.isPending && searchMutation.isSuccess && recipes.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <p className="text-2xl mb-2">🤷</p>
              <p>No recipes found with those filters.</p>
              <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => searchMutation.mutate(0)}>
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </Button>
            </div>
          )}

          {/* Recipe card */}
          {currentRecipe && !searchMutation.isPending && (
            <div className="space-y-3">
              {/* Counter */}
              <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
                <span className="font-medium text-foreground">Recipe {currentIdx + 1} of {recipes.length}</span>
                <div className="flex gap-1">
                  {recipes.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentIdx(i)}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        i === currentIdx ? "w-5 bg-violet-500" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                      )}
                    />
                  ))}
                </div>
              </div>

              <RecipeCard
                recipe={currentRecipe}
                index={currentIdx}
                total={recipes.length}
                avoidedIngredients={avoidedIngredients}
                substitutions={substitutions}
                onSave={() => saveRecipe(currentRecipe)}
                onNext={() => setCurrentIdx(i => Math.min(i + 1, recipes.length - 1))}
                onPrev={() => setCurrentIdx(i => Math.max(i - 1, 0))}
                isSaving={savingId === currentRecipe.id}
                isSaved={savedIds.has(currentRecipe.id)}
              />

              {/* Find different recipes — always visible once results load */}
              <Button
                variant="outline"
                className="w-full h-10 text-sm gap-2 border-dashed"
                onClick={handleFindMore}
                disabled={searchMutation.isPending}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Find different recipes
              </Button>
            </div>
          )}

          {/* Saved — go to planner nudge */}
          {hasSaved && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-green-500/10 border border-green-500/20 text-sm">
              <Calendar className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-muted-foreground">
                Head to <strong className="text-foreground">Weekly Plan</strong> to schedule your saved recipes.
              </span>
            </div>
          )}

        </div>
      </div>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason={upgradeReason}
      />
    </>
  );
}
