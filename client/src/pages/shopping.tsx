import { useState, useMemo } from "react";
import {
  ShoppingCart, Clipboard, Check, Sprout, Beef, Milk,
  Snowflake, Croissant, Package, Wheat, ChefHat, AlertCircle, Calendar, UtensilsCrossed
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
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [aiOptimizedList, setAiOptimizedList] = useState<any>(null);



  const weekStart = getMondayOfWeek(new Date()).toISOString().split("T")[0];

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
      return [...new Set(Object.values(meals).filter(Boolean) as number[])];
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

  function copyToClipboard() {
    if (!shoppingList) return;
    const lines: string[] = ["=== SHOPPING LIST ===\n"];
    for (const [cat, items] of Object.entries(shoppingList.categories)) {
      lines.push(`\n--- ${CATEGORY_LABELS[cat] ?? cat} ---`);
      for (const item of items) {
        const amtStr = item.amounts.join(" + ") + (item.amounts.length > 1 ? ` = ${item.amounts.length} batches` : "");
        lines.push(`${item.isStaple ? "(pantry) " : ""}${item.name}: ${amtStr}`);
      }
    }
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      toast({ title: "Copied to clipboard!" });
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const totalItems = shoppingList?.totalItems ?? 0;
  const checkedCount = checked.size;
  const plannedRecipeNames = useMemo(() => {
    if (!recipes || !plan?.meals) return [];
    try {
      const meals = JSON.parse(plan.meals);
      const ids = Object.values(meals).filter(Boolean) as number[];
      return [...new Set(ids.map((id) => recipes.find((r) => r.id === id)?.name ?? "Unknown"))];
    } catch { return []; }
  }, [recipes, plan]);

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
            onClick={copyToClipboard}
            disabled={!shoppingList}
            data-testid="button-copy-list"
          >
            {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Clipboard className="h-3.5 w-3.5 mr-1.5" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </div>

      {/* Recipes included */}
      {plannedRecipeNames.length > 0 && (
        <div className="px-6 py-2.5 border-b border-border bg-muted/30">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-muted-foreground font-medium">From:</span>
            {plannedRecipeNames.map((name) => (
              <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-5">
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
    </div>
  );
}
