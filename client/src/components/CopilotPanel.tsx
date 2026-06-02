import { useState, useEffect, useRef } from "react";
import {
  Sparkles, X, Check, Plus, Loader2, Clock, Users,
  ExternalLink, RefreshCw, Calendar, Search,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

// ─── Filter chip options ──────────────────────────────────────────────────────

const CUISINE_CHIPS = [
  { label: "All",           value: null },
  { label: "🍔 American",  value: "american" },
  { label: "🍝 Italian",   value: "italian" },
  { label: "🌮 Mexican",   value: "tex-mex" },
  { label: "🍜 Asian",     value: "asian" },
  { label: "🫒 Mediterranean", value: "mediterranean" },
  { label: "🍛 Indian",    value: "indian" },
  { label: "🍣 Japanese",  value: "japanese" },
  { label: "🌶️ Korean",   value: "korean" },
  { label: "🥐 French",    value: "french" },
  { label: "🎲 Surprise",  value: "surprise" },
];

const TIME_CHIPS = [
  { label: "Any time",     value: null },
  { label: "⚡ Under 30",  value: 30 },
  { label: "Under 45 min", value: 45 },
  { label: "Under 1 hour", value: 60 },
];

const TYPE_CHIPS = [
  { label: "All",            value: null },
  { label: "🍽️ Dinner",    value: "dinner" },
  { label: "🥗 Lunch",      value: "lunch" },
  { label: "🌅 Breakfast",  value: "breakfast" },
];

// ─── Result card ─────────────────────────────────────────────────────────────

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

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden hover:border-border/80 transition-colors">
      {/* Image */}
      <div className="relative h-40 bg-muted overflow-hidden">
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
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <p className="font-bold text-white text-sm leading-tight line-clamp-2">{recipe.title}</p>
        </div>
        {recipe.sourceUrl && (
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 right-2 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border text-xs text-muted-foreground flex-wrap">
        {cuisine && (
          <span className="capitalize px-1.5 py-0.5 rounded-full bg-muted font-medium text-foreground/80">{cuisine}</span>
        )}
        {dishType && cuisine !== dishType && (
          <span className="capitalize px-1.5 py-0.5 rounded-full bg-muted text-foreground/60">{dishType}</span>
        )}
        <span className="flex items-center gap-1 ml-auto">
          <Clock className="h-3 w-3" />{recipe.readyInMinutes} min
        </span>
        <span className="flex items-center gap-1">
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
            className="flex-1 h-8 text-xs gap-1.5 bg-[#C96A3A] hover:bg-[#A85530] text-white"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Save
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={onAddToPlan}
          className="flex-1 h-8 text-xs gap-1.5"
        >
          <Calendar className="h-3.5 w-3.5" />
          Add to Plan
        </Button>
      </div>
    </div>
  );
}

// ─── Chip button ─────────────────────────────────────────────────────────────

function Chip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap",
        active
          ? "bg-[#C96A3A] border-[#C96A3A] text-white shadow-sm"
          : "border-border hover:border-[#C96A3A]/50 hover:bg-muted/60 text-muted-foreground"
      )}
    >
      {label}
    </button>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
      <div className="h-40 bg-muted" />
      <div className="px-3 py-2 border-b border-border flex gap-2">
        <div className="h-4 w-16 bg-muted rounded-full" />
        <div className="h-4 w-12 bg-muted rounded-full ml-auto" />
      </div>
      <div className="px-3 py-2.5 flex gap-2">
        <div className="flex-1 h-8 bg-muted rounded-md" />
        <div className="flex-1 h-8 bg-muted rounded-md" />
      </div>
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

  // Search state
  const [query, setQuery] = useState("");
  const [cuisineFilter, setCuisineFilter] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // Results state
  const [recipes, setRecipes] = useState<SpoonacularRecipe[]>([]);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [savingId, setSavingId] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Lock body scroll when panel is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Focus search input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => searchInputRef.current?.focus(), 150);
  }, [open]);

  const searchMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/ai/copilot/find-recipes", {
        query: query.trim() || undefined,
        cuisineChoice: cuisineFilter ?? undefined,
        mealType: typeFilter ?? undefined,
        maxReadyTime: timeFilter ?? undefined,
      }).then(r => r.json()),
    onSuccess: (data) => {
      setRecipes(data.recipes || []);
      setHasSearched(true);
    },
    onError: (err: any) => {
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

  function handleSearch() {
    if (!query.trim() && !cuisineFilter && !timeFilter && !typeFilter) {
      searchInputRef.current?.focus();
      return;
    }
    searchMutation.mutate();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
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
    // Save first, then navigate to planner
    saveRecipe(recipe).then(() => {
      handleClose();
      setLocation("/planner");
    });
  }

  function handleClose() {
    if (onOpenChange) onOpenChange(false);
    else setInternalOpen(false);
  }

  function reset() {
    setQuery("");
    setCuisineFilter(null);
    setTimeFilter(null);
    setTypeFilter(null);
    setRecipes([]);
    setSavedIds(new Set());
    setHasSearched(false);
  }

  const hasFilters = !!query.trim() || !!cuisineFilter || !!timeFilter || !!typeFilter;

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
          "w-[calc(100vw-2rem)] max-w-lg max-h-[88vh]",
          "transition-all duration-200 ease-out",
          open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
        data-testid="panel-copilot"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border shrink-0 bg-gradient-to-r from-orange-600/10 to-amber-600/10">
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
              <button
                onClick={reset}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
              >
                Clear
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

        {/* Search + filters */}
        <div className="px-4 pt-4 pb-3 border-b border-border shrink-0 space-y-3">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Try: 'quick american dinners' or 'easy italian pasta'"
              className="w-full h-10 pl-9 pr-4 rounded-lg border border-border bg-muted text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-[#C96A3A]/50 focus:border-[#C96A3A]/50 transition-colors"
            />
          </div>

          {/* Cuisine chips */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Cuisine</p>
            <div className="flex flex-wrap gap-1.5">
              {CUISINE_CHIPS.map(c => (
                <Chip
                  key={String(c.value)}
                  label={c.label}
                  active={cuisineFilter === c.value}
                  onClick={() => setCuisineFilter(c.value)}
                />
              ))}
            </div>
          </div>

          {/* Time + Type chips in one row */}
          <div className="flex gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Time</p>
              <div className="flex flex-wrap gap-1.5">
                {TIME_CHIPS.map(t => (
                  <Chip
                    key={String(t.value)}
                    label={t.label}
                    active={timeFilter === t.value}
                    onClick={() => setTimeFilter(t.value)}
                  />
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Type</p>
              <div className="flex flex-wrap gap-1.5">
                {TYPE_CHIPS.map(t => (
                  <Chip
                    key={String(t.value)}
                    label={t.label}
                    active={typeFilter === t.value}
                    onClick={() => setTypeFilter(t.value)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Search button */}
          <Button
            onClick={handleSearch}
            disabled={searchMutation.isPending}
            className="w-full h-9 gap-2 bg-[#C96A3A] hover:bg-[#A85530] text-white text-sm font-semibold"
          >
            {searchMutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Searching...</>
              : <><Sparkles className="h-4 w-4" /> Find Recipes</>
            }
          </Button>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3 scrollbar-thin">

          {/* Loading skeletons */}
          {searchMutation.isPending && (
            <div className="grid grid-cols-1 gap-3">
              {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* Empty state */}
          {!searchMutation.isPending && hasSearched && recipes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <span className="text-4xl">🤷</span>
              <div>
                <p className="text-sm font-medium text-foreground">No recipes found</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Try broader terms like "american dinner" or "pasta" — or clear some filters.
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSearch}>
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </Button>
            </div>
          )}

          {/* Intro state */}
          {!searchMutation.isPending && !hasSearched && (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/20">
                <Search className="h-7 w-7 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Search for any recipe</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Type a query above or pick cuisine + time chips, then hit Find Recipes.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5 text-xs">
                {["quick american dinners", "easy italian pasta", "healthy lunch", "chicken under 30"].map(ex => (
                  <button
                    key={ex}
                    onClick={() => { setQuery(ex); setTimeout(handleSearch, 50); }}
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
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{recipes.length} recipe{recipes.length !== 1 ? 's' : ''} found</span>
                <button
                  onClick={handleSearch}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <RefreshCw className="h-3 w-3" /> Search again
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3">
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
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-green-500/10 border border-green-500/20 text-sm">
                  <Calendar className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-muted-foreground text-xs">
                    Saved! Head to <strong className="text-foreground">Weekly Plan</strong> to schedule them.
                  </span>
                </div>
              )}
            </>
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
