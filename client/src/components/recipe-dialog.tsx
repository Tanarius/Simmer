import { useState, useRef } from "react";
import { Heart, Clock, Users, ChevronRight, X, Plus, Link, Loader2, ExternalLink, Sparkles, Pencil, Check, AlertTriangle, Instagram, Upload, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { Recipe, InsertRecipe } from "@shared/schema";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatTimeBreakdown } from "@/lib/format-time";
import { groupIngredientsByCategory } from "@/lib/ingredientCategories";

const cuisineColors: Record<string, string> = {
  "tex-mex": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "italian": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  "asian": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "american": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "other": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

function parseTags(tagsJson: string | null | undefined): string[] {
  if (!tagsJson) return [];
  try { return JSON.parse(tagsJson); } catch { return []; }
}

function parseIngredients(ingredientsJson: string | null | undefined): Array<{ name: string; amount: number; unit: string; category: string }> {
  if (!ingredientsJson) return [];
  try {
    const result = JSON.parse(ingredientsJson);
    if (!Array.isArray(result)) return [];
    return result
      .filter(item => item && typeof item === 'object' && !Array.isArray(item))
      .map(item => ({
        name: String(item.name ?? ''),
        amount: Number(item.amount) || 0,
        unit: String(item.unit ?? ''),
        category: String(item.category ?? 'other'),
      }));
  } catch { return []; }
}

function parseInstructions(instructionsJson: string | null | undefined): string[] {
  if (!instructionsJson) return [];
  try { return JSON.parse(instructionsJson); } catch { return []; }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** Format a numeric amount into a clean display string (e.g. 0.5 → "1/2", 1.33 → "1 1/3") */
function formatAmount(amount: number): string {
  if (amount === 0) return "0";
  const whole = Math.floor(amount);
  const frac = amount - whole;

  // Common fraction map (tolerance-based matching)
  const fractions: [number, string][] = [
    [0, ""],
    [0.125, "1/8"],
    [0.167, "1/6"],
    [0.2, "1/5"],
    [0.25, "1/4"],
    [0.33, "1/3"],
    [0.375, "3/8"],
    [0.5, "1/2"],
    [0.625, "5/8"],
    [0.667, "2/3"],
    [0.75, "3/4"],
    [0.833, "5/6"],
    [0.875, "7/8"],
  ];

  // Find closest fraction within tolerance
  let bestFrac = "";
  let bestDiff = 0.05; // tolerance
  for (const [val, str] of fractions) {
    const diff = Math.abs(frac - val);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestFrac = str;
    }
  }

  if (whole > 0 && bestFrac) return `${whole} ${bestFrac}`;
  if (whole > 0) return `${whole}`;
  if (bestFrac) return bestFrac;
  // Fallback: round to 2 decimal places
  return String(Math.round(amount * 100) / 100);
}

// ========== VIEW DIALOG ==========
interface RecipeViewDialogProps {
  recipe: Recipe | null;
  open: boolean;
  onClose: () => void;
}

export function RecipeViewDialog({ recipe, open, onClose }: RecipeViewDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);

  // Taste profile for ingredient cross-out
  const { data: tasteProfile } = useQuery<any>({ queryKey: ["/api/taste-profile"], staleTime: 300_000 });
  const dislikedIngredients: string[] = tasteProfile?.dislikedIngredients ?? [];
  const ingredientSubs: Record<string, string | null> = (tasteProfile?.ingredientSubstitutions as any) ?? {};
  const [editName, setEditName] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [scaledServings, setScaledServings] = useState<number | null>(null);
  const [imgError, setImgError] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: { name: string; instructions: string }) =>
      apiRequest("PATCH", `/api/recipes/${recipe!.id}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Recipe updated" });
      setEditMode(false);
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  });

  function startEdit() {
    setEditName(recipe!.name);
    setEditInstructions(parseInstructions(recipe!.instructions).join('\n'));
    setEditMode(true);
  }

  function saveEdit() {
    const steps = editInstructions.split('\n').map(s => s.trim()).filter(Boolean);
    updateMutation.mutate({ name: editName, instructions: JSON.stringify(steps) });
  }

  const favoriteMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/recipes/${recipe!.id}/favorite`).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/recipes"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/recipes/${recipe!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Recipe deleted" });
      onClose();
    },
  });

  const cleanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/ai/clean-recipe/${recipe!.id}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to clean recipe");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Recipe Cleaned! ✨", description: "Standardized instructions and ingredients using Kitchen Copilot." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to clean recipe", description: err.message, variant: "destructive" });
    }
  });

  if (!recipe) return null;

  const tags = parseTags(recipe.tags);
  const baseIngredients = parseIngredients(recipe.ingredients);
  const instructions = parseInstructions(recipe.instructions);

  const baseServings = recipe.servings ?? 1;
  const displayServings = scaledServings ?? baseServings;
  const scale = displayServings / baseServings;

  const scaledIngredients = baseIngredients.map(ing => ({ ...ing, amount: ing.amount * scale }));
  const ingredientGroups = groupIngredientsByCategory(scaledIngredients);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setScaledServings(null); setImgError(false); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-recipe-view">

        {/* Recipe photo banner — bleeds to dialog edges via negative margins */}
        {recipe.imageUrl && !imgError && (
          <div className="relative h-44 -mx-6 -mt-6 mb-2 overflow-hidden rounded-t-lg shrink-0">
            <img
              src={recipe.imageUrl}
              alt={recipe.name}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            {/* Action buttons — inset from right so they don't clash with the shadcn X button */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
              <Button
                size="icon"
                variant="secondary"
                className={cn("h-8 w-8 bg-background/80 backdrop-blur-sm text-purple-500 hover:bg-background", cleanMutation.isPending && "opacity-50")}
                onClick={() => cleanMutation.mutate()}
                disabled={cleanMutation.isPending}
                title="Clean & Structure with Kitchen Copilot"
              >
                {cleanMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              </Button>
              {editMode ? (
                <Button size="icon" variant="secondary" className="h-8 w-8 bg-background/80 backdrop-blur-sm text-green-600" onClick={saveEdit} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </Button>
              ) : (
                <Button size="icon" variant="secondary" className="h-8 w-8 bg-background/80 backdrop-blur-sm" onClick={startEdit} data-testid="button-edit-recipe">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button size="icon" variant="secondary" className="h-8 w-8 bg-background/80 backdrop-blur-sm" onClick={() => favoriteMutation.mutate()} data-testid="button-view-favorite">
                <Heart className={cn("h-3.5 w-3.5", recipe.isFavorite ? "fill-red-500 text-red-500" : "")} />
              </Button>
            </div>
          </div>
        )}

        <div>
          <DialogHeader className="pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {editMode ? (
                  <Input value={editName} onChange={e => setEditName(e.target.value)} className="text-base font-semibold" data-testid="input-edit-recipe-name" />
                ) : (
                  <DialogTitle className="text-lg font-semibold leading-snug" data-testid="text-recipe-view-name">
                    {recipe.name}
                  </DialogTitle>
                )}
                {recipe.description && (
                  <DialogDescription className="mt-1 text-sm line-clamp-3 text-muted-foreground">{recipe.description}</DialogDescription>
                )}
              </div>

              {/* Action buttons when no image */}
              {(!recipe.imageUrl || imgError) && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="icon" variant="outline" className={cn("text-purple-500 border-purple-200 hover:bg-purple-50 dark:border-purple-800/50 dark:hover:bg-purple-900/30", cleanMutation.isPending && "opacity-50")} onClick={() => cleanMutation.mutate()} disabled={cleanMutation.isPending} title="Clean & Structure with Kitchen Copilot">
                    {cleanMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  </Button>
                  {editMode ? (
                    <Button size="icon" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={saveEdit} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                  ) : (
                    <Button size="icon" variant="ghost" onClick={startEdit} title="Edit recipe" data-testid="button-edit-recipe">
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => favoriteMutation.mutate()} data-testid="button-view-favorite">
                    <Heart className={cn("h-4 w-4", recipe.isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
                  </Button>
                </div>
              )}
            </div>

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize", cuisineColors[recipe.cuisine] ?? cuisineColors["other"])}>
                {recipe.cuisine}
              </span>
              <Badge variant="secondary" className="capitalize">{recipe.mealType === "either" ? "Lunch / Dinner" : recipe.mealType}</Badge>
              <Badge variant="secondary" className="capitalize">{recipe.difficulty}</Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatTimeBreakdown(recipe.prepTime ?? 0, recipe.cookTime ?? 0)}
              </span>
              {recipe.sourceUrl && (
                <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline" data-testid="link-source-url" onClick={e => e.stopPropagation()}>
                  <ExternalLink className="h-3 w-3" />
                  Source
                </a>
              )}
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map(tag => <Badge key={tag} variant="outline" className="text-xs capitalize">{tag}</Badge>)}
              </div>
            )}
          </DialogHeader>

          <Separator className="my-4" />

          {/* Ingredients + serving scaler */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">Ingredients</h4>
              {/* Serving scaler */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground mr-0.5">Scale</span>
                {[1, 2, 3, 4].map(mult => (
                  <button
                    key={mult}
                    onClick={() => setScaledServings(mult === 1 ? null : baseServings * mult)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                      scale === mult
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    ×{mult}
                  </button>
                ))}
              </div>
            </div>

            {/* Grouped ingredient list */}
            <div className="space-y-4">
              {ingredientGroups.map(({ category, items }) => (
                <div key={category.key}>
                  <p className={cn("text-xs font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1.5", category.headerClass)}>
                    <span>{category.emoji}</span>
                    {category.label}
                  </p>
                  <ul className="space-y-1">
                    {items.map((ing, i) => {
                      const lc = ing.name.toLowerCase();
                      const isDisliked = dislikedIngredients.some(d => d.toLowerCase() === lc);
                      const substitute = isDisliked ? (ingredientSubs[lc] ?? null) : null;
                      return (
                        <li key={i} className="flex items-center gap-3 text-sm py-1 rounded-lg px-2 hover:bg-muted/40 transition-colors group">
                          <span className={cn("w-1 h-5 rounded-full shrink-0", category.barClass)} />
                          <span className={cn("flex-1", isDisliked ? "line-through text-muted-foreground/50" : "text-foreground")}>
                            {ing.name}
                          </span>
                          {isDisliked && substitute && (
                            <span className="text-violet-500 text-xs shrink-0">→ {substitute}</span>
                          )}
                          {isDisliked && !substitute && (
                            <span title="Flagged in your dietary preferences">
                              <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                            </span>
                          )}
                          <span className="text-muted-foreground tabular-nums text-xs shrink-0">
                            {formatAmount(ing.amount)}{ing.unit ? ` ${ing.unit}` : ''}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <Separator className="my-4" />

          {/* Chef's Tips */}
          {recipe.tips && Array.isArray(recipe.tips) && recipe.tips.length > 0 && !editMode && (
            <>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1.5">👨‍🍳 Chef's Tips</p>
                <ul className="space-y-1">
                  {recipe.tips.map((tip: string, i: number) => (
                    <li key={i} className="text-sm text-foreground/80 flex gap-2">
                      <span className="text-amber-500 shrink-0">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
              <Separator className="my-4" />
            </>
          )}

          {/* Instructions */}
          {/* No instructions but has source — prompt user to visit original */}
          {instructions.length === 0 && !editMode && recipe.sourceUrl && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-muted/40 border border-border text-sm">
              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium text-foreground text-sm">Full instructions on source site</p>
                <a
                  href={recipe.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  View full recipe →
                </a>
              </div>
            </div>
          )}

          {(instructions.length > 0 || editMode) && (
            <div>
              <h4 className="text-sm font-semibold mb-3">Instructions</h4>
              {editMode ? (
                <div className="space-y-1">
                  <Textarea
                    value={editInstructions}
                    onChange={e => setEditInstructions(e.target.value)}
                    className="min-h-[180px] text-sm"
                    placeholder="One step per line"
                    data-testid="textarea-edit-instructions"
                  />
                  <p className="text-xs text-muted-foreground">One step per line</p>
                </div>
              ) : (
                <ol className="space-y-3">
                  {instructions.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5 tabular-nums">
                        {i + 1}
                      </span>
                      <span className="text-foreground leading-relaxed pt-0.5">{decodeHtmlEntities(step)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between mt-6 pt-4 border-t border-border">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending || editMode}
              data-testid="button-delete-recipe"
            >
              Delete Recipe
            </Button>
            {editMode && (
              <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ========== ADD RECIPE DIALOG ==========

interface AddRecipeDialogProps {
  open: boolean;
  onClose: () => void;
}

const INGREDIENT_CATEGORIES = ["produce", "protein", "dairy", "frozen", "bakery", "pantry", "grains", "condiments"];
const AVAILABLE_TAGS = ["crockpot", "quick", "make-ahead", "freezer-friendly", "one-pot", "one-pan"];

export function AddRecipeDialog({ open, onClose }: AddRecipeDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importTab, setImportTab] = useState<"url" | "social">("url");
  const [socialMode, setSocialMode] = useState<"text" | "image">("text");
  const [socialText, setSocialText] = useState("");
  const [isSocialImporting, setIsSocialImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cuisine, setCuisine] = useState<string>("");
  const [mealType, setMealType] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("easy");
  const [prepTime, setPrepTime] = useState<number>(10);
  const [cookTime, setCookTime] = useState<number>(30);
  const [servings, setServings] = useState<number>(3);
  const [tags, setTags] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState([
    { name: "", amount: 1, unit: "", category: "produce" }
  ]);
  const [instructions, setInstructions] = useState([""]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: Omit<InsertRecipe, 'householdId'>) => apiRequest("POST", "/api/recipes", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Recipe added!" });
      onClose();
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to add recipe", variant: "destructive" });
    },
  });

  function resetForm() {
    setName(""); setDescription(""); setCuisine(""); setMealType("");
    setDifficulty("easy"); setPrepTime(10); setCookTime(30); setServings(3);
    setTags([]); setIngredients([{ name: "", amount: 1, unit: "", category: "produce" }]);
    setInstructions([""]); setImportUrl(""); setImageUrl(null); setSourceUrl(null);
    setImportTab("url"); setSocialMode("text"); setSocialText("");
  }

  async function handleImportUrl() {
    if (!importUrl.trim()) return;
    setIsImporting(true);
    try {
      const res = await apiRequest("POST", "/api/recipes/import-url", { url: importUrl.trim() });
      const data = await res.json();
      if (data.error) {
        toast({ title: "Import failed", description: data.error, variant: "destructive" });
        return;
      }
      populateFromImport(data, importUrl.trim());
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message || "Could not reach the URL", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  }

  function populateFromImport(data: any, fallbackSource?: string) {
    setName(data.name || "");
    setDescription(data.description || "");
    setCuisine(data.cuisine || "other");
    setMealType(data.mealType || "dinner");
    setDifficulty(data.difficulty || "easy");
    setPrepTime(data.prepTime || 10);
    setCookTime(data.cookTime || 30);
    setServings(data.servings || 3);
    setTags(data.tags || []);
    setImageUrl(data.imageUrl || null);
    setSourceUrl(data.sourceUrl || fallbackSource || null);
    if (data.ingredients?.length > 0) {
      setIngredients(data.ingredients.map((i: any) => ({
        name: i.name || "",
        amount: i.amount || 1,
        unit: i.unit || "whole",
        category: i.category || "pantry",
      })));
    }
    if (data.instructions?.length > 0) {
      setInstructions(data.instructions);
    }
    toast({ title: "Recipe imported", description: "Review the fields below and save when ready." });
  }

  async function handleSocialImportText() {
    if (!socialText.trim()) return;
    setIsSocialImporting(true);
    try {
      const res = await apiRequest("POST", "/api/ai/import-from-social", {
        mode: "text",
        content: socialText.trim(),
      });
      const data = await res.json();
      if (data.error) {
        toast({ title: "Import failed", description: data.error, variant: "destructive" });
        return;
      }
      populateFromImport(data);
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message || "Could not parse the recipe", variant: "destructive" });
    } finally {
      setIsSocialImporting(false);
    }
  }

  async function handleSocialImportImage(file: File) {
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Please use a screenshot under 4 MB.", variant: "destructive" });
      return;
    }
    setIsSocialImporting(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await apiRequest("POST", "/api/ai/import-from-social", {
        mode: "image",
        content: base64,
        mimeType: file.type,
      });
      const data = await res.json();
      if (data.error) {
        toast({ title: "Import failed", description: data.error, variant: "destructive" });
        return;
      }
      populateFromImport(data);
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message || "Could not read the image", variant: "destructive" });
    } finally {
      setIsSocialImporting(false);
    }
  }

  function toggleTag(tag: string) {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  }

  function addIngredient() {
    setIngredients([...ingredients, { name: "", amount: 1, unit: "", category: "produce" }]);
  }

  function removeIngredient(idx: number) {
    setIngredients(ingredients.filter((_, i) => i !== idx));
  }

  function updateIngredient(idx: number, field: string, value: string | number) {
    setIngredients(ingredients.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing));
  }

  function addInstruction() {
    setInstructions([...instructions, ""]);
  }

  function removeInstruction(idx: number) {
    setInstructions(instructions.filter((_, i) => i !== idx));
  }

  function updateInstruction(idx: number, value: string) {
    setInstructions(instructions.map((inst, i) => i === idx ? value : inst));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !cuisine || !mealType) {
      toast({ title: "Please fill in name, cuisine, and meal type", variant: "destructive" });
      return;
    }

    const filteredIngredients = ingredients.filter((i) => i.name.trim());
    const filteredInstructions = instructions.filter((s) => s.trim());

    createMutation.mutate({
      name,
      description: description || null,
      cuisine,
      mealType,
      difficulty,
      prepTime,
      cookTime,
      servings,
      ingredients: JSON.stringify(filteredIngredients),
      instructions: JSON.stringify(filteredInstructions),
      tags: JSON.stringify(tags),
      imageUrl,
      sourceUrl,
      isFavorite: 0,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); resetForm(); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-add-recipe">
        <DialogHeader>
          <DialogTitle>Add New Recipe</DialogTitle>
          <DialogDescription>Add a recipe to your meal prep library.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Import Section — URL or Social */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            {/* Tab row */}
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setImportTab("url")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  importTab === "url"
                    ? "bg-background border border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Link className="h-3 w-3" /> Import from URL
              </button>
              <button
                type="button"
                onClick={() => setImportTab("social")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  importTab === "social"
                    ? "bg-background border border-border text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Instagram className="h-3 w-3" /> Instagram / Social
              </button>
            </div>

            {/* URL tab */}
            {importTab === "url" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste a recipe URL (AllRecipes, Food Network, Tasty, etc.)"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleImportUrl(); } }}
                    data-testid="input-import-url"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleImportUrl}
                    disabled={isImporting || !importUrl.trim()}
                    data-testid="button-import-url"
                  >
                    {isImporting ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Importing...</>
                    ) : (
                      "Import"
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Works with most major recipe sites. The form below will auto-fill — review and save.
                </p>
              </div>
            )}

            {/* Social tab */}
            {importTab === "social" && (
              <div className="space-y-3">
                {/* Mode toggle */}
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setSocialMode("text")}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors",
                      socialMode === "text"
                        ? "bg-orange-500/10 text-orange-400 border border-orange-500/30"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <FileText className="h-3 w-3" /> Paste caption
                  </button>
                  <button
                    type="button"
                    onClick={() => setSocialMode("image")}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors",
                      socialMode === "image"
                        ? "bg-orange-500/10 text-orange-400 border border-orange-500/30"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Upload className="h-3 w-3" /> Upload screenshot
                  </button>
                </div>

                {socialMode === "text" ? (
                  <div className="space-y-2">
                    <Textarea
                      placeholder={"Paste the recipe caption from Instagram, TikTok, Facebook, etc.\n\nExample:\n'My famous chicken tikka! You'll need:\n- 1 lb chicken\n- 1 cup yogurt...'"}
                      value={socialText}
                      onChange={(e) => setSocialText(e.target.value)}
                      className="min-h-[100px] text-xs"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      onClick={handleSocialImportText}
                      disabled={isSocialImporting || !socialText.trim()}
                    >
                      {isSocialImporting ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Extracting recipe...</>
                      ) : (
                        <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Extract Recipe with AI</>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div
                      className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-orange-500/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (file) handleSocialImportImage(file);
                      }}
                    >
                      {isSocialImporting ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
                          <p className="text-xs text-muted-foreground">Extracting recipe from screenshot...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                          <p className="text-sm font-medium">Drop screenshot here or click to browse</p>
                          <p className="text-xs text-muted-foreground">PNG, JPG, WebP — max 4 MB</p>
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSocialImportImage(file);
                        e.target.value = "";
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Take a screenshot of an Instagram or TikTok recipe post and upload it. AI will extract the recipe automatically.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Basic info */}
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="recipe-name">Recipe Name *</Label>
              <Input
                id="recipe-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Crockpot Chicken Tacos"
                data-testid="input-recipe-name"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recipe-description">Description</Label>
              <Textarea
                id="recipe-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short description..."
                rows={2}
                data-testid="input-recipe-description"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Cuisine *</Label>
              <Select value={cuisine} onValueChange={setCuisine}>
                <SelectTrigger data-testid="select-cuisine">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tex-mex">Tex-Mex</SelectItem>
                  <SelectItem value="italian">Italian</SelectItem>
                  <SelectItem value="asian">Asian</SelectItem>
                  <SelectItem value="american">American</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Meal Type *</Label>
              <Select value={mealType} onValueChange={setMealType}>
                <SelectTrigger data-testid="select-meal-type">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                  <SelectItem value="either">Either</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger data-testid="select-difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prep-time">Prep Time (min)</Label>
              <Input
                id="prep-time"
                type="number"
                min={0}
                value={prepTime}
                onChange={(e) => setPrepTime(Number(e.target.value))}
                data-testid="input-prep-time"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cook-time">Cook Time (min)</Label>
              <Input
                id="cook-time"
                type="number"
                min={0}
                value={cookTime}
                onChange={(e) => setCookTime(Number(e.target.value))}
                data-testid="input-cook-time"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="servings">Servings</Label>
              <Input
                id="servings"
                type="number"
                min={1}
                value={servings}
                onChange={(e) => setServings(Number(e.target.value))}
                data-testid="input-servings"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border transition-colors",
                    tags.includes(tag)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  )}
                  data-testid={`button-tag-${tag}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Ingredients */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Ingredients</Label>
              <Button type="button" variant="outline" size="sm" onClick={addIngredient} data-testid="button-add-ingredient">
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {ingredients.map((ing, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_100px_100px_auto] gap-2 items-center">
                  <Input
                    placeholder="Ingredient name"
                    value={ing.name}
                    onChange={(e) => updateIngredient(idx, "name", e.target.value)}
                    data-testid={`input-ingredient-name-${idx}`}
                  />
                  <Input
                    type="number"
                    placeholder="Amt"
                    value={ing.amount}
                    min={0}
                    step="any"
                    onChange={(e) => updateIngredient(idx, "amount", Number(e.target.value))}
                    data-testid={`input-ingredient-amount-${idx}`}
                  />
                  <Input
                    placeholder="Unit"
                    value={ing.unit}
                    onChange={(e) => updateIngredient(idx, "unit", e.target.value)}
                    data-testid={`input-ingredient-unit-${idx}`}
                  />
                  <Select value={ing.category} onValueChange={(v) => updateIngredient(idx, "category", v)}>
                    <SelectTrigger data-testid={`select-ingredient-category-${idx}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INGREDIENT_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeIngredient(idx)}
                    data-testid={`button-remove-ingredient-${idx}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Instructions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Instructions</Label>
              <Button type="button" variant="outline" size="sm" onClick={addInstruction} data-testid="button-add-instruction">
                <Plus className="h-3 w-3 mr-1" /> Add Step
              </Button>
            </div>
            <div className="space-y-2">
              {instructions.map((step, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground text-xs font-semibold shrink-0 mt-2.5">
                    {idx + 1}
                  </span>
                  <Textarea
                    value={step}
                    onChange={(e) => updateInstruction(idx, e.target.value)}
                    placeholder={`Step ${idx + 1}...`}
                    rows={1}
                    className="flex-1 resize-none"
                    data-testid={`input-instruction-${idx}`}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeInstruction(idx)}
                    data-testid={`button-remove-instruction-${idx}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => { onClose(); resetForm(); }} data-testid="button-cancel-recipe">
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-recipe">
              {createMutation.isPending ? "Adding..." : "Add Recipe"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
