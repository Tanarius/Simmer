import { useState } from "react";
import { Heart, Clock, Users, ChevronRight, X, Plus, Minus, Link, Loader2 } from "lucide-react";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatTimeBreakdown } from "@/lib/format-time";

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

function parseIngredients(ingredientsJson: string): Array<{ name: string; amount: number; unit: string; category: string }> {
  try { return JSON.parse(ingredientsJson); } catch { return []; }
}

function parseInstructions(instructionsJson: string | null | undefined): string[] {
  if (!instructionsJson) return [];
  try { return JSON.parse(instructionsJson); } catch { return []; }
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

  if (!recipe) return null;

  const tags = parseTags(recipe.tags);
  const ingredients = parseIngredients(recipe.ingredients);
  const instructions = parseInstructions(recipe.instructions);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-recipe-view">
        <DialogHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold leading-snug" data-testid="text-recipe-view-name">
                {recipe.name}
              </DialogTitle>
              {recipe.description && (
                <DialogDescription className="mt-1 text-sm">
                  {recipe.description}
                </DialogDescription>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => favoriteMutation.mutate()}
              data-testid="button-view-favorite"
            >
              <Heart
                className={cn("h-4 w-4", recipe.isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground")}
              />
            </Button>
          </div>

          {/* Metadata */}
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
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {recipe.servings} servings
            </span>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs capitalize">{tag}</Badge>
              ))}
            </div>
          )}
        </DialogHeader>

        <Separator className="my-1" />

        {/* Ingredients */}
        <div className="mt-3">
          <h4 className="text-sm font-semibold mb-2">Ingredients</h4>
          <ul className="space-y-1.5">
            {ingredients.map((ing, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-foreground">{ing.name}</span>
                <span className="text-muted-foreground ml-auto shrink-0">{ing.amount} {ing.unit}</span>
              </li>
            ))}
          </ul>
        </div>

        <Separator className="my-3" />

        {/* Instructions */}
        {instructions.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Instructions</h4>
            <ol className="space-y-2">
              {instructions.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-foreground leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end mt-4 pt-3 border-t border-border">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            data-testid="button-delete-recipe"
          >
            Delete Recipe
          </Button>
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

  const createMutation = useMutation({
    mutationFn: (data: InsertRecipe) => apiRequest("POST", "/api/recipes", data).then(r => r.json()),
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
    setInstructions([""]); setImportUrl("");
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
      // Populate form fields from imported data
      setName(data.name || "");
      setDescription(data.description || "");
      setCuisine(data.cuisine || "other");
      setMealType(data.mealType || "dinner");
      setDifficulty(data.difficulty || "easy");
      setPrepTime(data.prepTime || 10);
      setCookTime(data.cookTime || 30);
      setServings(data.servings || 3);
      setTags(data.tags || []);
      if (data.ingredients && data.ingredients.length > 0) {
        setIngredients(data.ingredients.map((i: any) => ({
          name: i.name || "",
          amount: i.amount || 1,
          unit: i.unit || "whole",
          category: i.category || "pantry",
        })));
      }
      if (data.instructions && data.instructions.length > 0) {
        setInstructions(data.instructions);
      }
      toast({ title: "Recipe imported", description: "Review the fields below and save when ready." });
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message || "Could not reach the URL", variant: "destructive" });
    } finally {
      setIsImporting(false);
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
          {/* URL Import */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Link className="h-3 w-3" />
              Import from URL
            </Label>
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
                    step={0.25}
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
