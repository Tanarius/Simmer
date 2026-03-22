import { useState } from "react";
import { Plus, X, Package, Search, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
];

const CATEGORY_COLORS: Record<string, string> = {
  spices: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  oils: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  condiments: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  grains: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  pantry: "bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-300",
  dairy: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  produce: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  other: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

export default function PantryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("pantry");
  const [search, setSearch] = useState("");

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

  const filteredStaples = (staples ?? []).filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  // Group by category
  const grouped = filteredStaples.reduce<Record<string, PantryStaple[]>>((acc, staple) => {
    if (!acc[staple.category]) acc[staple.category] = [];
    acc[staple.category].push(staple);
    return acc;
  }, {});

  const sortedCategories = CATEGORIES.filter((c) => grouped[c]?.length > 0);
  // Add any unexpected categories
  for (const cat of Object.keys(grouped)) {
    if (!sortedCategories.includes(cat)) sortedCategories.push(cat);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pantry Staples</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {staples?.length ?? 0} items always on hand · dimmed on shopping list
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl px-6 py-5 space-y-6">
          {/* Add new staple */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold mb-3">Add Staple</h2>
            <form onSubmit={handleAdd} className="flex gap-2">
              <Input
                placeholder="e.g. Oregano"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1"
                data-testid="input-staple-name"
              />
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="w-36" data-testid="select-staple-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="submit"
                disabled={!newName.trim() || addMutation.isPending}
                data-testid="button-add-staple"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add
              </Button>
            </form>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Items in this list will appear dimmed on your shopping list, since you likely already have them at home.
              Remove any items you're running low on.
            </p>
          </div>

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
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-5 w-24 mb-2" />
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Skeleton key={j} className="h-8 w-24 rounded-full" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : filteredStaples.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {search ? "No staples match your search" : "No pantry staples yet"}
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
            <div className="space-y-5">
              {sortedCategories.map((cat) => (
                <div key={cat} data-testid={`section-staples-${cat}`}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        CATEGORY_COLORS[cat] ?? CATEGORY_COLORS["other"]
                      )}
                    >
                      {cat}
                    </span>
                    <span className="text-xs text-muted-foreground">{grouped[cat]?.length ?? 0} items</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(grouped[cat] ?? []).map((staple) => (
                      <div
                        key={staple.id}
                        className="group flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1.5 bg-muted border border-border text-sm font-medium text-foreground"
                        data-testid={`staple-item-${staple.id}`}
                      >
                        <span>{staple.name}</span>
                        <button
                          onClick={() => deleteMutation.mutate(staple.id)}
                          disabled={deleteMutation.isPending}
                          className="flex items-center justify-center w-4 h-4 rounded-full bg-muted-foreground/20 hover:bg-destructive/20 hover:text-destructive transition-colors"
                          aria-label={`Remove ${staple.name}`}
                          data-testid={`button-remove-staple-${staple.id}`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
