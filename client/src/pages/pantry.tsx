import { useState } from "react";
import { Plus, X, Search, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { PantryStaple } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "spices",
  "oils",
  "condiments",
  "grains",
  "pantry",
  "dairy",
  "produce",
  "other",
] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_META: Record<Category, { emoji: string; label: string; bg: string; border: string; chipBg: string; chipText: string }> = {
  spices:     { emoji: "🌶️", label: "Spices & Herbs",   bg: "bg-red-50 dark:bg-red-950/30",       border: "border-red-200 dark:border-red-900/40",       chipBg: "bg-red-100 dark:bg-red-900/30",       chipText: "text-red-700 dark:text-red-200" },
  oils:       { emoji: "🫙",  label: "Oils & Fats",      bg: "bg-yellow-50 dark:bg-yellow-950/30", border: "border-yellow-200 dark:border-yellow-900/40", chipBg: "bg-yellow-100 dark:bg-yellow-900/30", chipText: "text-yellow-700 dark:text-yellow-200" },
  condiments: { emoji: "🥫",  label: "Condiments",       bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-900/40", chipBg: "bg-orange-100 dark:bg-orange-900/30", chipText: "text-orange-700 dark:text-orange-200" },
  grains:     { emoji: "🌾",  label: "Grains & Pasta",   bg: "bg-amber-50 dark:bg-amber-950/30",   border: "border-amber-200 dark:border-amber-900/40",   chipBg: "bg-amber-100 dark:bg-amber-900/30",   chipText: "text-amber-700 dark:text-amber-200" },
  pantry:     { emoji: "🥡",  label: "Pantry Staples",   bg: "bg-stone-100 dark:bg-stone-900/50",  border: "border-stone-300 dark:border-stone-700/40",   chipBg: "bg-stone-200 dark:bg-stone-800/50",   chipText: "text-stone-700 dark:text-stone-300" },
  dairy:      { emoji: "🧀",  label: "Dairy & Eggs",     bg: "bg-blue-50 dark:bg-blue-950/30",     border: "border-blue-200 dark:border-blue-900/40",     chipBg: "bg-blue-100 dark:bg-blue-900/30",     chipText: "text-blue-700 dark:text-blue-200" },
  produce:    { emoji: "🥦",  label: "Produce",          bg: "bg-green-50 dark:bg-green-950/30",   border: "border-green-200 dark:border-green-900/40",   chipBg: "bg-green-100 dark:bg-green-900/30",   chipText: "text-green-700 dark:text-green-200" },
  other:      { emoji: "📦",  label: "Other",            bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-900/40", chipBg: "bg-purple-100 dark:bg-purple-900/30", chipText: "text-purple-700 dark:text-purple-200" },
};

const SUGGESTIONS: Record<Category, string[]> = {
  spices:     ["Salt", "Black pepper", "Garlic powder", "Onion powder", "Paprika", "Cumin", "Chili powder", "Oregano", "Basil", "Thyme", "Rosemary", "Cayenne", "Turmeric", "Cinnamon", "Bay leaves", "Red pepper flakes"],
  oils:       ["Olive oil", "Vegetable oil", "Coconut oil", "Butter", "Sesame oil", "Avocado oil", "Cooking spray"],
  condiments: ["Soy sauce", "Hot sauce", "Ketchup", "Mustard", "Worcestershire sauce", "Apple cider vinegar", "White vinegar", "Fish sauce", "Sriracha", "Teriyaki sauce", "Oyster sauce", "Hoisin sauce"],
  grains:     ["White rice", "Brown rice", "Pasta", "Breadcrumbs", "Oats", "Quinoa", "Flour", "Cornstarch", "Panko", "Couscous", "Lentils"],
  pantry:     ["Chicken broth", "Beef broth", "Vegetable broth", "Tomato paste", "Diced tomatoes", "Coconut milk", "Black beans", "Chickpeas", "Honey", "Sugar", "Brown sugar", "Baking powder", "Baking soda", "Vanilla extract"],
  dairy:      ["Eggs", "Parmesan", "Cheddar", "Mozzarella", "Cream cheese", "Sour cream", "Heavy cream", "Milk", "Greek yogurt", "Butter"],
  produce:    ["Garlic", "Onion", "Shallots", "Ginger", "Lemon", "Lime", "Potatoes"],
  other:      ["Toothpicks", "Plastic wrap", "Aluminum foil", "Parchment paper"],
};

export default function PantryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("pantry");
  const [search, setSearch] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [expandedSuggCategories, setExpandedSuggCategories] = useState<Record<string, boolean>>({});

  const { data: staples, isLoading } = useQuery<PantryStaple[]>({
    queryKey: ["/api/staples"],
  });

  const addMutation = useMutation({
    mutationFn: (data: { name: string; category: string }) =>
      apiRequest("POST", "/api/staples", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staples"] });
      setNewName("");
    },
    onError: () => {
      toast({ title: "Failed to add staple", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/staples/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staples"] });
    },
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    addMutation.mutate({ name: newName.trim(), category: newCategory });
  }

  function quickAdd(name: string, category: Category) {
    addMutation.mutate({ name, category });
  }

  const addedNames = new Set((staples ?? []).map(s => s.name.toLowerCase()));

  const filteredStaples = (staples ?? []).filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filteredStaples.reduce<Record<string, PantryStaple[]>>((acc, staple) => {
    if (!acc[staple.category]) acc[staple.category] = [];
    acc[staple.category].push(staple);
    return acc;
  }, {});

  const sortedCategories = CATEGORIES.filter((c) => grouped[c]?.length > 0);
  for (const cat of Object.keys(grouped)) {
    if (!sortedCategories.includes(cat as Category)) sortedCategories.push(cat as Category);
  }

  function toggleSuggCategory(cat: string) {
    setExpandedSuggCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pantry Staples</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {staples?.length ?? 0} items · dimmed on shopping list
          </p>
        </div>
      </div>

      {/* Two-column layout on desktop */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

        {/* ─── Left panel: Quick Add + Custom Add (sticky on desktop) ─── */}
        <div className="lg:w-80 xl:w-96 shrink-0 border-b lg:border-b-0 lg:border-r border-border overflow-y-auto scrollbar-thin">
          <div className="p-4 space-y-4">

            {/* Quick Add */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
                onClick={() => setQuickAddOpen(p => !p)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">⚡</span>
                  <span className="text-sm font-semibold">Quick Add</span>
                </div>
                {quickAddOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              {quickAddOpen && (
                <div className="px-4 pb-4 border-t border-border">
                  <p className="text-xs text-muted-foreground pt-2 pb-2">Tap a chip to add instantly</p>
                  <div className="max-h-60 overflow-y-auto space-y-2 scrollbar-thin">
                  {CATEGORIES.map(cat => {
                    const meta = CATEGORY_META[cat];
                    const available = SUGGESTIONS[cat].filter(s => !addedNames.has(s.toLowerCase()));
                    if (available.length === 0) return null;
                    const isExpanded = expandedSuggCategories[cat];
                    const shown = isExpanded ? available : available.slice(0, 6);

                    return (
                      <div key={cat} className="pt-1">
                        <button
                          className="flex items-center gap-1.5 mb-1.5 group"
                          onClick={() => toggleSuggCategory(cat)}
                        >
                          <span className="text-sm">{meta.emoji}</span>
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide group-hover:text-foreground transition-colors">
                            {meta.label}
                          </span>
                          {isExpanded
                            ? <ChevronUp className="h-3 w-3 text-muted-foreground/60" />
                            : <ChevronDown className="h-3 w-3 text-muted-foreground/60" />
                          }
                        </button>
                        <div className="flex flex-wrap gap-1.5">
                          {shown.map(s => (
                            <button
                              key={s}
                              onClick={() => quickAdd(s, cat)}
                              disabled={addMutation.isPending}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition-all",
                                "hover:scale-105 active:scale-95",
                                meta.chipBg, meta.chipText, meta.border
                              )}
                            >
                              <Plus className="h-2.5 w-2.5 opacity-70" />
                              {s}
                            </button>
                          ))}
                          {!isExpanded && available.length > 6 && (
                            <button
                              onClick={() => toggleSuggCategory(cat)}
                              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs text-muted-foreground border border-dashed border-border hover:border-foreground/40 transition-colors"
                            >
                              +{available.length - 6} more
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </div>{/* end scrollable suggestion list */}
                </div>
              )}
            </div>

            {/* Custom Add Form */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Plus className="h-3.5 w-3.5" /> Custom Add
              </h2>
              <form onSubmit={handleAdd} className="space-y-3">
                <Input
                  placeholder="e.g. Smoked paprika"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  data-testid="input-staple-name"
                />
                {/* Visual category chips */}
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(cat => {
                    const meta = CATEGORY_META[cat];
                    const selected = newCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewCategory(cat)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition-all",
                          selected
                            ? cn("scale-105 ring-1 ring-offset-1 ring-offset-card", meta.chipBg, meta.chipText, meta.border, "ring-current")
                            : "bg-muted text-muted-foreground border-border hover:border-foreground/30"
                        )}
                      >
                        <span>{meta.emoji}</span>
                        <span className="capitalize">{cat}</span>
                      </button>
                    );
                  })}
                </div>
                <Button
                  type="submit"
                  disabled={!newName.trim() || addMutation.isPending}
                  data-testid="button-add-staple"
                  size="sm"
                  className="w-full"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add to pantry
                </Button>
              </form>
            </div>

          </div>
        </div>

        {/* ─── Right panel: search + staple groups ─── */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-4 space-y-4">

            {/* Search */}
            {(staples?.length ?? 0) > 8 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  type="search"
                  placeholder="Search staples..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                  data-testid="input-search-staples"
                />
              </div>
            )}

            {/* Staple groups */}
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border p-4">
                    <Skeleton className="h-6 w-28 mb-3" />
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Skeleton key={j} className="h-8 w-20 rounded-full" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredStaples.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <span className="text-4xl mb-3">📦</span>
                <p className="text-sm text-muted-foreground">
                  {search ? "No staples match your search" : "No pantry staples yet — use Quick Add!"}
                </p>
                {search && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setSearch("")}
                    data-testid="button-clear-search"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {sortedCategories.map((cat) => {
                  const meta = CATEGORY_META[cat as Category] ?? CATEGORY_META.other;
                  return (
                    <div
                      key={cat}
                      className={cn("rounded-xl border p-4", meta.bg, meta.border)}
                      data-testid={`section-staples-${cat}`}
                    >
                      {/* Category header */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl leading-none">{meta.emoji}</span>
                        <div>
                          <p className="text-sm font-semibold leading-tight">{meta.label}</p>
                          <p className="text-xs text-muted-foreground">{grouped[cat]?.length ?? 0} items</p>
                        </div>
                      </div>
                      {/* Chips */}
                      <div className="flex flex-wrap gap-2">
                        {(grouped[cat] ?? []).map((staple) => (
                          <div
                            key={staple.id}
                            className="group flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1.5 bg-background/50 border border-border/60 text-sm font-medium text-foreground hover:border-border transition-colors"
                            data-testid={`staple-item-${staple.id}`}
                          >
                            <span>{staple.name}</span>
                            <button
                              onClick={() => deleteMutation.mutate(staple.id)}
                              disabled={deleteMutation.isPending}
                              className="flex items-center justify-center w-4 h-4 rounded-full bg-muted-foreground/20 hover:bg-destructive/20 hover:text-destructive transition-colors opacity-60 group-hover:opacity-100"
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
    </div>
  );
}
