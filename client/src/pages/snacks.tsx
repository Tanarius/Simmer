import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Trash2, ShoppingCart, X, ChefHat, Loader2, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface OFFProduct {
  offId: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  calories: number | null;
  protein: string | null;
  carbs: string | null;
  fat: string | null;
  categories: string[];
  servingDisplay?: string;
}

interface WishlistItem {
  id: number;
  name: string;
  brand: string | null;
  notes: string | null;
  imageUrl: string | null;
  productData: string | null;
  addedBy: number | null;
  createdAt: string;
}

async function apiRequest(method: string, url: string, body?: any) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(d.error ?? "Request failed");
  }
  return res.json();
}

function categoryEmoji(categories: string[]): string {
  const cat = (categories[0] ?? "").toLowerCase();
  if (/snack|chip|cracker|popcorn|pretzel/.test(cat)) return "🍿";
  if (/beverage|drink|soda|juice|water|tea|coffee/.test(cat)) return "🥤";
  if (/dairy|cheese|milk|yogurt|butter/.test(cat)) return "🧀";
  if (/bakery|bread|cake|cookie|muffin|pastry/.test(cat)) return "🍞";
  if (/candy|chocolate|confection|sweet/.test(cat)) return "🍫";
  if (/frozen/.test(cat)) return "🧊";
  if (/cereal|grain/.test(cat)) return "🥣";
  return "🛒";
}

function ProductCard({ product, onAdd }: { product: OFFProduct; onAdd: (p: OFFProduct) => void }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors group">
      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
        {product.imageUrl
          ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
          : <span className="text-2xl select-none" role="img">{categoryEmoji(product.categories)}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{product.name}</p>
        {product.brand && <p className="text-xs text-muted-foreground truncate">{product.brand}</p>}
        <div className="flex flex-wrap gap-x-2 mt-0.5 text-[11px] text-muted-foreground">
          {product.calories != null && <span><span className="font-medium text-foreground">{product.calories}</span> cal</span>}
          {product.protein && <span><span className="font-medium text-foreground">{product.protein}</span> protein</span>}
          {product.carbs && <span><span className="font-medium text-foreground">{product.carbs}</span> carbs</span>}
        </div>
        {product.servingDisplay && (
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{product.servingDisplay}</p>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => onAdd(product)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Wishlist
        </Button>
        <Button size="sm" variant="default" className="h-8 px-2 text-xs" onClick={() => {
          const term = encodeURIComponent(product.brand ? `${product.brand} ${product.name}` : product.name);
          window.open(`https://www.instacart.com/store/search_v3/?search_term=${term}`, "_blank");
        }}>
          <ShoppingCart className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function WishlistCard({ item, onDelete, onAddToList }: { item: WishlistItem; onDelete: (id: number) => void; onAddToList: (id: number) => void }) {
  const product = item.productData ? JSON.parse(item.productData) : null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card group">
      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
        {item.imageUrl
          ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
          : <Package className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        {item.brand && <p className="text-xs text-muted-foreground truncate">{item.brand}</p>}
        {item.notes && <p className="text-xs text-muted-foreground italic truncate">{item.notes}</p>}
        {product?.calories != null && (
          <p className="text-[11px] text-muted-foreground">{product.calories} cal · {product.protein} protein</p>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => onAddToList(item.id)}>
          <ShoppingCart className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => onDelete(item.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function SnacksPage() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OFFProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Clear search state when navigating away so every visit starts fresh
  useEffect(() => {
    return () => {
      setQuery("");
      setSearchResults([]);
      setSearched(false);
    };
  }, []);

  const { data: wishlist = [], isLoading: wishlistLoading } = useQuery<WishlistItem[]>({
    queryKey: ["/api/snacks/wishlist"],
    queryFn: () => apiRequest("GET", "/api/snacks/wishlist"),
  });

  const addToWishlistMutation = useMutation({
    mutationFn: (product: OFFProduct) => apiRequest("POST", "/api/snacks/wishlist", {
      name: product.name,
      brand: product.brand || undefined,
      imageUrl: product.imageUrl || undefined,
      productData: JSON.stringify(product),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snacks/wishlist"] });
      toast({ title: "Added to wishlist", duration: 2000 });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteWishlistMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/snacks/wishlist/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/snacks/wishlist"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addToShoppingMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/snacks/wishlist/${id}/add-to-shopping`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snacks/shopping"] });
      toast({ title: "Added to shopping list", duration: 2000 });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Debounced search
  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (searchRef.current) clearTimeout(searchRef.current);
    if (!val.trim()) { setSearchResults([]); setSearched(false); return; }
    searchRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiRequest("GET", `/api/snacks/products/search?q=${encodeURIComponent(val)}`);
        setSearchResults(Array.isArray(res) ? res : []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); setSearched(true); }
    }, 400);
  };

  const handleAddToWishlist = async (product: OFFProduct) => {
    setAddingId(product.offId);
    await addToWishlistMutation.mutateAsync(product).catch(() => {});
    setAddingId(null);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Snacks & Products</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Search real products, save to wishlist, add to your shopping list</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search chips, cereal, drinks, snacks…"
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          className="pl-9 pr-9"
          autoComplete="off"
        />
        {query && (
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => { setQuery(""); setSearchResults([]); }}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Results */}
      {(searching || searched) && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {searching ? "Searching…" : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`}
          </p>
          {searching
            ? <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            : searchResults.length === 0
              ? <p className="text-sm text-muted-foreground text-center py-6">No products found for "{query}". Try a brand name like "Lay's" or "Cheerios".</p>
              : searchResults.map(p => (
                  <ProductCard
                    key={p.offId}
                    product={p}
                    onAdd={handleAddToWishlist}
                  />
                ))
          }
        </div>
      )}

      {/* Wishlist */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Household Wishlist</h2>
          {wishlist.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={async () => {
                await Promise.all(wishlist.map(item => addToShoppingMutation.mutateAsync(item.id).catch(() => {})));
                toast({ title: `${wishlist.length} items added to shopping list`, duration: 2500 });
              }}
            >
              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
              Add all to list
            </Button>
          )}
        </div>

        {wishlistLoading
          ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : wishlist.length === 0
            ? (
              <div className="text-center py-10 text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Your wishlist is empty.</p>
                <p className="text-xs mt-1">Search above and tap Wishlist to save snacks.</p>
              </div>
            )
            : (
              <div className="space-y-2">
                {wishlist.map(item => (
                  <WishlistCard
                    key={item.id}
                    item={item}
                    onDelete={id => deleteWishlistMutation.mutate(id)}
                    onAddToList={id => addToShoppingMutation.mutate(id)}
                  />
                ))}
              </div>
            )
        }
      </div>

      {/* Quick tip */}
      {!query && wishlist.length === 0 && (
        <div className="rounded-xl bg-orange-500/5 border border-orange-500/20 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">💡 How it works</p>
          <ul className="space-y-1 text-xs">
            <li>Search any product — we pull from millions of real grocery items</li>
            <li>Save to your household wishlist so everyone can see what's wanted</li>
            <li>Tap <strong>Add</strong> to move items to your shopping list</li>
            <li>Use the <ShoppingCart className="inline h-3 w-3" /> button to find items on Instacart</li>
          </ul>
        </div>
      )}
    </div>
  );
}
