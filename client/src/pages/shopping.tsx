import { useState, useMemo } from "react";
import {
  ShoppingCart, Plus, Trash2, Check, Sprout, Beef, Milk,
  Snowflake, Croissant, Package, Wheat, ChefHat, Calendar,
  ExternalLink, Clipboard, Download, X, Loader2, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import type { WeeklyPlan } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ShoppingListOptimizer } from "@/components/ShoppingListOptimizer";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PersistentItem {
  id: number;
  name: string;
  amount: string | null;
  unit: string | null;
  category: string;
  checked: boolean;
  source: string | null;
  sourceId: number | null;
  productData: string | null;
  createdAt: string;
}

interface LegacyShoppingItem {
  name: string;
  amounts: string[];
  isStaple: boolean;
}

interface LegacyShoppingListResponse {
  totalItems: number;
  recipeCount: number;
  categories: Record<string, LegacyShoppingItem[]>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  produce: <Sprout className="h-4 w-4" />,
  protein: <Beef className="h-4 w-4" />,
  dairy: <Milk className="h-4 w-4" />,
  frozen: <Snowflake className="h-4 w-4" />,
  bakery: <Croissant className="h-4 w-4" />,
  pantry: <Package className="h-4 w-4" />,
  grains: <Wheat className="h-4 w-4" />,
  condiments: <ChefHat className="h-4 w-4" />,
  snacks: <Package className="h-4 w-4" />,
  other: <Package className="h-4 w-4" />,
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
  snacks: "Snacks & Drinks",
  other: "Other",
};

const STORE_LINKS = [
  { name: "Instacart", color: "bg-[#43b02a] hover:bg-[#3a9924] text-white", buildUrl: (q: string) => `https://www.instacart.com/store/search_v3/term/${encodeURIComponent(q)}` },
  { name: "Walmart", color: "bg-[#0071dc] hover:bg-[#005cbf] text-white", buildUrl: (q: string) => `https://www.walmart.com/search?q=${encodeURIComponent(q)}` },
  { name: "Amazon", color: "bg-[#ff9900] hover:bg-[#e68a00] text-white", buildUrl: (q: string) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}&i=amazonfresh` },
];

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

// ── Item Row ──────────────────────────────────────────────────────────────────

function ShoppingItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: PersistentItem;
  onToggle: (id: number, checked: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const product = useMemo(() => {
    if (!item.productData) return null;
    try { return JSON.parse(item.productData); } catch { return null; }
  }, [item.productData]);

  const searchTerm = product?.brand ? `${product.brand} ${item.name}` : item.name;

  return (
    <div className={cn(
      "flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors group",
      item.checked ? "opacity-50" : "hover:bg-accent/30"
    )}>
      {/* Product image or placeholder */}
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
        {product?.imageUrl
          ? <img src={product.imageUrl} alt={item.name} className="w-full h-full object-contain" />
          : <span className="text-xs text-muted-foreground">{CATEGORY_ICONS[item.category] ?? <Package className="h-4 w-4" />}</span>
        }
      </div>

      {/* Checkbox */}
      <button
        onClick={() => onToggle(item.id, !item.checked)}
        className={cn(
          "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
          item.checked
            ? "bg-primary border-primary"
            : "border-border hover:border-primary"
        )}
      >
        {item.checked && <Check className="h-3 w-3 text-primary-foreground" />}
      </button>

      {/* Name + amount */}
      <div className="flex-1 min-w-0">
        <span className={cn("text-sm", item.checked && "line-through text-muted-foreground")}>{item.name}</span>
        {(item.amount || item.unit) && (
          <span className="text-xs text-muted-foreground ml-1.5">
            {[item.amount, item.unit].filter(Boolean).join(" ")}
          </span>
        )}
        {product?.brand && <p className="text-[11px] text-muted-foreground truncate">{product.brand}</p>}
      </div>

      {/* Store links + delete */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {STORE_LINKS.map(store => (
          <Tooltip key={store.name}>
            <TooltipTrigger asChild>
              <button
                onClick={() => window.open(store.buildUrl(searchTerm), "_blank")}
                className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", store.color)}
              >
                {store.name[0]}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Find on {store.name}</TooltipContent>
          </Tooltip>
        ))}
        <button
          onClick={() => onDelete(item.id)}
          className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ShoppingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const weekStart = getMondayOfWeek(new Date());
  const [newItem, setNewItem] = useState("");
  const [importingPlan, setImportingPlan] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: items = [], isLoading } = useQuery<PersistentItem[]>({
    queryKey: ["/api/snacks/shopping"],
    queryFn: () => fetch("/api/snacks/shopping", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 15_000, // household sync every 15s
  });

  const { data: plan } = useQuery<WeeklyPlan>({
    queryKey: ["/api/plans", weekStart],
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  const toggleMutation = useMutation({
    mutationFn: ({ id, checked }: { id: number; checked: boolean }) =>
      fetch(`/api/snacks/shopping/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ checked }),
      }).then(r => r.json()),
    onMutate: async ({ id, checked }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/snacks/shopping"] });
      const prev = queryClient.getQueryData<PersistentItem[]>(["/api/snacks/shopping"]);
      queryClient.setQueryData<PersistentItem[]>(["/api/snacks/shopping"], old =>
        (old ?? []).map(i => i.id === id ? { ...i, checked } : i)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/snacks/shopping"], ctx.prev);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/snacks/shopping/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/snacks/shopping"] }),
  });

  const addItemMutation = useMutation({
    mutationFn: (name: string) => fetch("/api/snacks/shopping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name }),
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snacks/shopping"] });
      setNewItem("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const clearCheckedMutation = useMutation({
    mutationFn: () => fetch("/api/snacks/shopping?checked=true", { method: "DELETE", credentials: "include" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/snacks/shopping"] }),
  });

  // ── Import from this week's plan ─────────────────────────────────────────

  const importFromPlan = async () => {
    if (!plan?.meals) { toast({ title: "No plan this week", description: "Add recipes to your weekly plan first." }); return; }
    setImportingPlan(true);
    try {
      const meals = JSON.parse(plan.meals);
      const recipeIds = [...new Set(Object.values(meals).filter((v): v is number => typeof v === "number" && !!v))];
      if (recipeIds.length === 0) { toast({ title: "No recipes in plan" }); return; }

      // Generate shopping list via existing endpoint
      const generated: LegacyShoppingListResponse = await apiRequest("POST", "/api/shopping-list", { recipeIds }).then(r => r.json());

      // Flatten to bulk-add format
      const bulkItems = Object.entries(generated.categories).flatMap(([cat, catItems]) =>
        (catItems as LegacyShoppingItem[]).map(item => ({
          name: item.name,
          amount: item.amounts.join(" + "),
          category: cat,
          source: "recipe",
        }))
      );

      await fetch("/api/snacks/shopping/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items: bulkItems }),
      });

      queryClient.invalidateQueries({ queryKey: ["/api/snacks/shopping"] });
      toast({ title: `${bulkItems.length} items added from this week's plan`, duration: 3000 });
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    } finally {
      setImportingPlan(false);
    }
  };

  // ── Export ───────────────────────────────────────────────────────────────

  function buildExportText() {
    const grouped = groupByCategory(items.filter(i => !i.checked));
    const lines = ["=== SHOPPING LIST ===", ""];
    for (const [cat, catItems] of Object.entries(grouped)) {
      lines.push(`--- ${CATEGORY_LABELS[cat] ?? cat} ---`);
      catItems.forEach(item => {
        const qty = [item.amount, item.unit].filter(Boolean).join(" ");
        lines.push(qty ? `${item.name}: ${qty}` : item.name);
      });
      lines.push("");
    }
    return lines.join("\n");
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(buildExportText()).then(() => {
      setCopied(true);
      toast({ title: "Copied to clipboard!" });
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function exportTxt() {
    const blob = new Blob([buildExportText()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shopping-list-${weekStart}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  function groupByCategory(list: PersistentItem[]): Record<string, PersistentItem[]> {
    const order = ["produce", "protein", "dairy", "frozen", "bakery", "pantry", "grains", "condiments", "snacks", "other"];
    const groups: Record<string, PersistentItem[]> = {};
    for (const item of list) {
      const cat = item.category ?? "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return Object.fromEntries(order.filter(k => groups[k]).map(k => [k, groups[k]]));
  }

  const unchecked = items.filter(i => !i.checked);
  const checkedItems = items.filter(i => i.checked);
  const grouped = groupByCategory(unchecked);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Shopping List</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {unchecked.length} item{unchecked.length !== 1 ? "s" : ""} · synced across household
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={copyToClipboard} disabled={items.length === 0}>
                {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy list</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={exportTxt} disabled={items.length === 0}>
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export .txt</TooltipContent>
          </Tooltip>
          {checkedItems.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive" onClick={() => clearCheckedMutation.mutate()}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear checked ({checkedItems.length})</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Add item + Import from plan */}
      <div className="flex gap-2">
        <form className="flex gap-2 flex-1" onSubmit={e => { e.preventDefault(); if (newItem.trim()) addItemMutation.mutate(newItem.trim()); }}>
          <Input
            placeholder="Add item…"
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={!newItem.trim() || addItemMutation.isPending} className="shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </form>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={importFromPlan}
              disabled={importingPlan}
              className="shrink-0 gap-1.5"
            >
              {importingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
              <span className="hidden sm:inline text-xs">This week's plan</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Import from this week's meal plan</TooltipContent>
        </Tooltip>
      </div>

      {/* AI Optimizer */}
      {unchecked.length > 0 && (
        <ShoppingListOptimizer
          currentItems={unchecked.map(i => {
            const qty = [i.amount, i.unit].filter(Boolean).join(" ");
            return qty ? `${i.name} (${qty})` : i.name;
          })}
          onOptimized={() => {}}
        />
      )}

      {/* List */}
      {isLoading
        ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        : items.length === 0
          ? (
            <div className="text-center py-16 text-muted-foreground space-y-3">
              <ShoppingCart className="h-10 w-10 mx-auto opacity-30" />
              <div>
                <p className="text-sm font-medium">Your list is empty</p>
                <p className="text-xs mt-1">Add items manually or import from this week's meal plan.</p>
              </div>
            </div>
          )
          : (
            <div className="space-y-4">
              {/* Unchecked grouped by category */}
              {Object.entries(grouped).map(([cat, catItems]) => (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-1 px-3">
                    <span className="text-muted-foreground">{CATEGORY_ICONS[cat] ?? <Package className="h-4 w-4" />}</span>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {CATEGORY_LABELS[cat] ?? cat}
                    </span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{catItems.length}</Badge>
                  </div>
                  <div className="rounded-xl border border-border overflow-hidden">
                    {catItems.map((item, idx) => (
                      <div key={item.id}>
                        {idx > 0 && <Separator />}
                        <ShoppingItemRow
                          item={item}
                          onToggle={(id, checked) => toggleMutation.mutate({ id, checked })}
                          onDelete={id => deleteMutation.mutate(id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Checked items */}
              {checkedItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1 px-3">
                    <Check className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">In cart</span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{checkedItems.length}</Badge>
                  </div>
                  <div className="rounded-xl border border-border overflow-hidden">
                    {checkedItems.map((item, idx) => (
                      <div key={item.id}>
                        {idx > 0 && <Separator />}
                        <ShoppingItemRow
                          item={item}
                          onToggle={(id, checked) => toggleMutation.mutate({ id, checked })}
                          onDelete={id => deleteMutation.mutate(id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shop entire list on stores */}
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs font-medium mb-2 text-muted-foreground">Shop your list online</p>
                <div className="flex flex-wrap gap-2">
                  {STORE_LINKS.map(store => (
                    <button
                      key={store.name}
                      onClick={() => window.open(store.buildUrl(unchecked[0]?.name ?? "groceries"), "_blank")}
                      className={cn("text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5", store.color)}
                    >
                      <ExternalLink className="h-3 w-3" />
                      {store.name}
                    </button>
                  ))}
                  <p className="text-[11px] text-muted-foreground self-center ml-1">
                    Opens store search • hover items for per-item links
                  </p>
                </div>
              </div>
            </div>
          )
      }
    </div>
  );
}
