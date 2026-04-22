import { useState, useMemo, useEffect } from "react";
import {
  ShoppingCart, Clipboard, Check, Sprout, Beef, Milk,
  Snowflake, Croissant, Package, Wheat, ChefHat, AlertCircle, Calendar, UtensilsCrossed, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Recipe, WeeklyPlan } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { ShoppingListOptimizer } from "@/components/ShoppingListOptimizer";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  produce: <Sprout className="h-4 w-4" />,
  protein: <Beef className="h-4 w-4" />,
  dairy: <Milk className="h-4 w-4" />,
  frozen: <Snowflake className="h-4 w-4" />,
  bakery: <Croissant className="h-4 w-4" />,
  pantry: <Package className="h-4 w-4" />,
  grains: <Wheat className="h-4 w-4" />,
  condiments: <ChefHat className="h-4 w-4" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  produce: "Produce",
  protein: "Protein & Meat",
  dairy: "Dairy & Eggs",
  frozen: "Frozen",
  bakery: "Bakery",
  pantry: "Pantry",
  grains: "Grains & Pasta",
  condiments: "Condiments & Sauces",
};

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface ShoppingItem {
  name: string;
  amounts: string[];
  isStaple: boolean;
}

interface ShoppingListResponse {
  totalItems: number;
  recipeCount: number;
  categories: Record<string, ShoppingItem[]>;
}

export default function ShoppingPage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [aiOptimizedList, setAiOptimizedList] = useState<any>(null);
  const [scale, setScale] = useState(1);

  const weekStart = getMondayOfWeek(new Date()).toISOString().split("T")[0];
  const storageKey = `shopping-checked-${weekStart}`;

  // Persist checked items to localStorage keyed by week — survives refresh
  const [checked, setChecked] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify([...checked])); } catch { /* ignore */ }
  }, [checked, storageKey]);

  // Get current week's plan
  const { data: plan } = useQuery<WeeklyPlan>({
    queryKey: ["/api/plans", weekStart],
  });

  // Get all recipes for context
  const { data: recipes } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  const recipeIds = useMemo(() => {
    if (!plan?.meals) return [];
    try {
      const meals = JSON.parse(plan.meals);
      return [...new Set(Object.values(meals).filter((v): v is number => typeof v === 'number' && !!v))];
    } catch { return []; }
  }, [plan]);

  // Generate shopping list from planned recipes
  const {
    data: shoppingList,
    isLoading,
    refetch,
  } = useQuery<ShoppingListResponse>({
    queryKey: ["/api/shopping-list", recipeIds],
    queryFn: () => apiRequest("POST", "/api/shopping-list", { recipeIds }).then(r => r.json()),
    enabled: recipeIds.length > 0,
  });

  const rawItems = useMemo(() => {
    if (!shoppingList) return [];
    const items: string[] = [];
    Object.values(shoppingList.categories).forEach((cat: any) => {
      cat.forEach((item: any) => items.push(`${item.name} (${item.amounts.join(' + ')})`));
    });
    return items;
  }, [shoppingList]);

  // Get recipe names for a given set of IDs (for tooltip)
  function getRecipeNamesForIngredient(ingredientName: string): string[] {
    if (!recipes || !plan?.meals) return [];
    try {
      const meals = JSON.parse(plan.meals);
      const ids = Object.values(meals).filter(Boolean) as number[];
      return recipes
        .filter((r) => {
          if (!ids.includes(r.id)) return false;
          try {
            const ings = JSON.parse(r.ingredients) as Array<{ name: string }>;
            return ings.some((i) => i.name.toLowerCase() === ingredientName.toLowerCase());
          } catch { return false; }
        })
        .map((r) => r.name);
    } catch { return []; }
  }

  function toggleItem(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function buildListText(): string {
    if (!shoppingList) return "";
    const lines: string[] = ["=== SHOPPING LIST ==="];
    if (scale !== 1) lines.push(`Amounts multiplied by ×${scale}`);
    lines.push("");
    for (const [cat, items] of Object.entries(shoppingList.categories)) {
      lines.push(`--- ${CATEGORY_LABELS[cat] ?? cat} ---`);
      for (const item of items) {
        const amtStr = item.amounts.join(" + ") + (item.amounts.length > 1 ? ` = ${item.amounts.length} batches` : "");
        lines.push(`${item.isStaple ? "(pantry) " : ""}${item.name}: ${amtStr}`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  function copyToClipboard() {
    if (!shoppingList) return;
    navigator.clipboard.writeText(buildListText()).then(() => {
      setCopied(true);
      toast({ title: "Copied to clipboard!" });
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function exportAsTxt() {
    if (!shoppingList) return;
    const blob = new Blob([buildListText()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shopping-list-${weekStart}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalItems = shoppingList?.totalItems ?? 0;
  const checkedCount = checked.size;

  // O(1) lookup map — avoids O(n²) scan in the sidebar
  const recipeById = useMemo(() => new Map(recipes?.map(r => [r.id, r]) ?? []), [recipes]);
  const recipeByName = useMemo(() => new Map(recipes?.map(r => [r.name, r]) ?? []), [recipes]);

  const plannedRecipeNames = useMemo(() => {
    if (!plan?.meals) return [];
    try {
      const meals = JSON.parse(plan.meals);
      const ids = Object.values(meals).filter(Boolean) as number[];
      return [...new Set(ids.map((id) => recipeById.get(id)?.name ?? "Unknown"))];
    } catch { return []; }
  }, [recipeById, plan]);

  if (recipeIds.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Shopping List</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Generated from your weekly plan</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-center px-6">
          <ShoppingCart className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-sm font-medium text-muted-foreground mb-1">No meals planned yet</p>
          <p className="text-xs text-muted-foreground/60 mb-4">Plan your week first, then come back to generate your shopping list.</p>
          <Button asChild size="sm" data-testid="button-go-to-planner">
            <Link href="/planner">
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Go to Weekly Plan
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Shopping List</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {shoppingList ? `${totalItems} items from ${shoppingList.recipeCount} recipes · ${checkedCount} checked` : "Loading..."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {shoppingList && (
            <ShoppingListOptimizer
              currentItems={rawItems}
              onOptimized={setAiOptimizedList}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={exportAsTxt}
            disabled={!shoppingList}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print-list">
            🖨️ Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={copyToClipboard}
            disabled={!shoppingList}
            data-testid="button-copy-list"
          >
            {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Clipboard className="h-3.5 w-3.5 mr-1.5" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </div>

      {/* Content — two column on desktop */}
      <div className="flex-1 overflow-auto flex flex-col lg:flex-row min-h-0">
      <div className="flex-1 overflow-auto px-6 py-5 no-print">
        {isLoading ? (
          <div className="space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-6 w-32 mb-3" />
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="h-10 rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : shoppingList ? (
          <div className="space-y-6 max-w-2xl">
            {aiOptimizedList && (
              <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-lg mb-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-purple-400">AI Optimized List</h3>
                  <Button variant="ghost" size="icon" onClick={() => setAiOptimizedList(null)}>✕</Button>
                </div>
                {aiOptimizedList.sections.map((sec: any) => (
                  <div key={sec.sectionName} className="mb-4">
                    <h4 className="font-semibold mb-1">{sec.sectionName}</h4>
                    <ul className="list-disc pl-5 text-sm">
                      {sec.items.map((item: any) => (
                        <li key={item.name}>{item.quantity} {item.unit} {item.name}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            {!aiOptimizedList && Object.entries(shoppingList.categories).map(([cat, items]) => {
              const categoryCheckedCount = items.filter((item) =>
                checked.has(`${cat}:${item.name}`)
              ).length;

              return (
                <div key={cat} data-testid={`section-${cat}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary">
                      {CATEGORY_ICONS[cat] ?? <Package className="h-4 w-4" />}
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {CATEGORY_LABELS[cat] ?? cat}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {categoryCheckedCount}/{items.length}
                    </span>
                  </div>

                  <div className="space-y-1.5 ml-9">
                    {items.map((item) => {
                      const key = `${cat}:${item.name}`;
                      const isChecked = checked.has(key);
                      const recipeNames = getRecipeNamesForIngredient(item.name);
                      const amtDisplay = item.amounts.length > 1
                        ? `${item.amounts.join(" + ")}`
                        : item.amounts[0];

                      return (
                        <Tooltip key={item.name} delayDuration={300}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2 border border-border transition-colors cursor-pointer",
                                isChecked
                                  ? "bg-muted/50 border-transparent"
                                  : item.isStaple
                                  ? "bg-background border-border/50 opacity-60"
                                  : "bg-card hover:bg-accent/30"
                              )}
                              onClick={() => toggleItem(key)}
                              data-testid={`item-${key.replace(/[^a-z0-9]/gi, "-")}`}
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => toggleItem(key)}
                                className="shrink-0"
                                data-testid={`checkbox-${key.replace(/[^a-z0-9]/gi, "-")}`}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span
                                className={cn(
                                  "flex-1 text-sm",
                                  isChecked ? "line-through text-muted-foreground" : "text-foreground"
                                )}
                              >
                                {item.name}
                              </span>
                              {item.isStaple && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0 text-muted-foreground">
                                  pantry
                                </Badge>
                              )}
                              <span className={cn("text-xs text-muted-foreground shrink-0", isChecked && "line-through")}>
                                {amtDisplay}
                              </span>
                            </div>
                          </TooltipTrigger>
                          {recipeNames.length > 0 && (
                            <TooltipContent side="right" className="max-w-48">
                              <p className="text-xs font-medium mb-1">Used in:</p>
                              <ul className="space-y-0.5">
                                {recipeNames.map((name) => (
                                  <li key={name} className="text-xs">• {name}</li>
                                ))}
                              </ul>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Staples note */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border">
              <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Items marked <span className="font-medium">pantry</span> are staples you likely already have. Check your pantry before buying.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col w-72 shrink-0 border-l border-border bg-card/30 px-5 py-5 gap-5 no-print overflow-y-auto">
        {/* This week's recipes */}
        {plannedRecipeNames.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">This week's meals</p>
            <div className="space-y-2">
              {plannedRecipeNames.map(name => {
                const recipe = recipeByName.get(name);
                return (
                  <div key={name} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border border-border">
                    <span className="text-lg shrink-0">🍽️</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{name}</p>
                      {recipe && <p className="text-[10px] text-muted-foreground capitalize">{recipe.cuisine} · {(recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)}m</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Servings multiplier */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Scale servings</p>
          <div className="flex gap-1.5 flex-wrap">
            {[1, 1.5, 2, 3].map(s => (
              <button key={s} onClick={() => setScale(s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                  scale === s ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"
                )}
              >×{s}</button>
            ))}
          </div>
          {scale !== 1 && <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 font-medium">⚠️ Multiply all amounts by ×{scale} when shopping</p>}
        </div>

        {/* Progress */}
        {shoppingList && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Progress</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">{checkedCount}</span>
              <span className="text-sm text-muted-foreground">/ {totalItems} items</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2">
              <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: totalItems ? `${(checkedCount/totalItems)*100}%` : '0%' }} />
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
