import { useState } from "react";
import { Plus, X, Search, Package, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { PantryStaple } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  "spices", "oils", "condiments", "grains", "pantry", "dairy", "produce", "other",
] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_META: Record<Category, { icon: string; label: string; color: string; bg: string }> = {
  spices:     { icon: "🧂", label: "Spices & Herbs",  color: "text-red-700 dark:text-red-300",    bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" },
  oils:       { icon: "🫒", label: "Oils & Fats",     color: "text-yellow-700 dark:text-yellow-300", bg: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800" },
  condiments: { icon: "🧴", label: "Condiments",       color: "text-orange-700 dark:text-orange-300", bg: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800" },
  grains:     { icon: "🌾", label: "Grains & Pasta",   color: "text-amber-700 dark:text-amber-300",  bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" },
  pantry:     { icon: "🥫", label: "Canned & Dry",     color: "text-stone-700 dark:text-stone-300",  bg: "bg-stone-50 dark:bg-stone-900/20 border-stone-200 dark:border-stone-800" },
  dairy:      { icon: "🥛", label: "Dairy & Eggs",     color: "text-blue-700 dark:text-blue-300",   bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" },
  produce:    { icon: "🥦", label: "Produce",          color: "text-green-700 dark:text-green-300",  bg: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" },
  other:      { icon: "📦", label: "Other",            color: "text-purple-700 dark:text-purple-300", bg: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800" },
};

// ─── quick-add suggestions per category ───────────────────────────────────────

const QUICK_ADD: Record<Category, string[]> = {
  spices:     ["Salt", "Black pepper", "Garlic powder", "Onion powder", "Cumin", "Paprika", "Chili powder", "Italian seasoning", "Red pepper flakes", "Cinnamon", "Oregano", "Thyme"],
  oils:       ["Olive oil", "Vegetable oil", "Sesame oil", "Coconut oil", "Butter"],
  condiments: ["Soy sauce", "Hot sauce", "Worcestershire sauce", "Fish sauce", "Mustard", "Ketchup", "Mayo", "Hoisin sauce", "Sriracha"],
  grains:     ["Rice", "Pasta", "Quinoa", "Oats", "Flour", "Breadcrumbs", "Couscous"],
  pantry:     ["Chicken broth", "Vegetable broth", "Canned diced tomatoes", "Tomato paste", "Coconut milk", "Sugar", "Brown sugar", "Honey", "Canned beans", "Canned chickpeas"],
  dairy:      ["Eggs", "Parmesan", "Butter"],
  produce:    ["Garlic", "Onion", "Lemons"],
  other:      ["Baking powder", "Baking soda", "Vanilla extract", "Cornstarch"],
};

// ─── PantryPage ───────────────────────────────────────────────────────────────

export default function PantryPage() {
  const { toast }      = useToast();
  const queryClient    = useQueryClient();
  const [search, setSearch] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState<Category | null>(null);

  // inline add state
  const [addCategory, setAddCategory] = useState<Category>("spices");
  const [addName, setAddName]         = useState("");

  const { data: staples, isLoading } = useQuery<PantryStaple[]>({
    queryKey: ["/api/staples"],
  });

  const addMutation = useMutation({
    mutationFn: (data: { name: string; category: string }) =>
      apiRequest("POST", "/api/staples", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staples"] });
      setAddName("");
    },
    onError: () => toast({ title: "Failed to add staple", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/staples/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/staples"] }),
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addName.trim()) return;
    addMutation.mutate({ name: addName.trim(), category: addCategory });
  }

  function quickAdd(name: string, category: Category) {
    const exists = staples?.some(s => s.name.toLowerCase() === name.toLowerCase());
    if (exists) return;
    addMutation.mutate({ name, category });
  }

  const filtered = (staples ?? []).filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  const grouped: Partial<Record<string, PantryStaple[]>> = {};
  for (const s of filtered) {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category]!.push(s);
  }

  // use CATEGORIES order, then any extras
  const sortedCats = [
    ...CATEGORIES.filter(c => grouped[c]?.length),
    ...Object.keys(grouped).filter(c => !CATEGORIES.includes(c as Category) && grouped[c]?.length),
  ] as string[];

  const stapleNames = new Set((staples ?? []).map(s => s.name.toLowerCase()));

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Pantry Staples</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {staples?.length ?? 0} items always on hand · dimmed on your shopping list
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl px-6 py-5 space-y-5">

          {/* ── Quick-add by category ── */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Quick Add Common Staples</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIES.map(cat => {
                const meta = CATEGORY_META[cat];
                const isOpen = quickAddOpen === cat;
                const suggestions = QUICK_ADD[cat].filter(name => !stapleNames.has(name.toLowerCase()));
                return (
                  <div key={cat} className="flex flex-col gap-1">
                    <button
                      onClick={() => setQuickAddOpen(isOpen ? null : cat)}
                      className={cn(
                        "flex items-center justify-between gap-1.5 rounded-lg px-2.5 py-2 border text-xs font-medium transition-colors",
                        isOpen
                          ? cn(meta.bg, meta.color, "border-current/30")
                          : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span>{meta.icon}</span>
                        <span className="truncate">{meta.label}</span>
                      </span>
                      {isOpen ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
                    </button>

                    {isOpen && (
                      <div className="rounded-lg border border-border bg-background p-2 flex flex-wrap gap-1.5 col-span-full">
                        {suggestions.length === 0 && (
                          <p className="text-[10px] text-muted-foreground px-1">All added ✓</p>
                        )}
                        {suggestions.map(name => (
                          <button
                            key={name}
                            onClick={() => quickAdd(name, cat)}
                            disabled={addMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs
                                       border border-border bg-muted hover:bg-primary hover:text-primary-foreground
                                       hover:border-primary transition-colors"
                          >
                            <Plus className="h-2.5 w-2.5" /> {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Custom add form ── */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold mb-3">Add Custom Staple</h2>
            <form onSubmit={handleAdd} className="flex gap-2 flex-wrap">
              {/* category chips */}
              <div className="flex flex-wrap gap-1.5 w-full mb-1">
                {CATEGORIES.map(cat => {
                  const meta = CATEGORY_META[cat];
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setAddCategory(cat)}
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors",
                        addCategory === cat
                          ? cn(meta.bg, meta.color, "border-current/30")
                          : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                      )}
                    >
                      {meta.icon} {cat}
                    </button>
                  );
                })}
              </div>
              <Input
                placeholder={`e.g. ${QUICK_ADD[addCategory]?.[3] ?? "Oregano"}`}
                value={addName}
                onChange={e => setAddName(e.target.value)}
                className="flex-1 min-w-48"
                data-testid="input-staple-name"
              />
              <Button
                type="submit"
                disabled={!addName.trim() || addMutation.isPending}
                data-testid="button-add-staple"
              >
                <Plus className="h-4 w-4 mr-1.5" /> Add
              </Button>
            </form>
          </div>

          {/* ── Search ── */}
          {(staples?.length ?? 0) > 8 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search staples…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9"
                data-testid="input-search-staples"
              />
            </div>
          )}

          {/* ── Staple groups ── */}
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-6 w-32 mb-2 rounded-lg" />
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 6 }).map((_, j) => <Skeleton key={j} className="h-8 w-24 rounded-full" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Package className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {search ? "No staples match your search" : "No pantry staples yet — use Quick Add above!"}
              </p>
              {search && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSearch("")}
                  data-testid="button-clear-search">
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {sortedCats.map(cat => {
                const meta = CATEGORY_META[cat as Category] ?? { icon: "📦", label: cat, color: "text-foreground", bg: "bg-muted" };
                const items = grouped[cat] ?? [];
                return (
                  <div key={cat} className={cn("rounded-xl border p-4", meta.bg)} data-testid={`section-staples-${cat}`}>
                    {/* section header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl">{meta.icon}</span>
                      <span className={cn("text-sm font-semibold", meta.color)}>{meta.label}</span>
                      <span className="text-xs text-muted-foreground ml-1">{items.length}</span>
                    </div>

                    {/* staple pills */}
                    <div className="flex flex-wrap gap-2">
                      {items.map(staple => (
                        <div
                          key={staple.id}
                          className="group flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1.5
                                     bg-background/80 border border-border/60 text-sm font-medium text-foreground
                                     hover:border-border transition-colors"
                          data-testid={`staple-item-${staple.id}`}
                        >
                          <span>{staple.name}</span>
                          <button
                            onClick={() => deleteMutation.mutate(staple.id)}
                            disabled={deleteMutation.isPending}
                            className="flex items-center justify-center w-4 h-4 rounded-full
                                       bg-muted-foreground/10 hover:bg-destructive/20 hover:text-destructive
                                       transition-colors"
                            aria-label={`Remove ${staple.name}`}
                            data-testid={`button-remove-staple-${staple.id}`}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
