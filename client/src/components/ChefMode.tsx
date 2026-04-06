import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Clock, ChefHat, CheckCircle2, XCircle } from "lucide-react";
import { AILimitModal } from "./AILimitModal";
import { useToast } from "@/hooks/use-toast";
import { generateShoppingListItems } from "@/lib/utils"; // Assume utility exists or mock

export function ChefMode() {
  const [ingredients, setIngredients] = useState("");
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [callsUsed, setCallsUsed] = useState(0);
  const [callsLimit, setCallsLimit] = useState(5);
  const { toast } = useToast();

  const suggestMutation = useMutation({
    mutationFn: async (ingredientsList: string[]) => {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: ingredientsList }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw data;
      }
      return data;
    },
    onError: (err: any) => {
      if (err.upgradePrompt) {
        setCallsUsed(err.callsUsed);
        setCallsLimit(err.callsLimit);
        setShowLimitModal(true);
      } else {
        toast({ title: "Failed to generate recipes", description: err.error || "An unknown error occurred", variant: "destructive" });
      }
    }
  });

  const handleGenerate = () => {
    if (!ingredients.trim()) return;
    const list = ingredients.split(",").map(i => i.trim()).filter(Boolean);
    suggestMutation.mutate(list);
  };

  return (
    <div className="space-y-6">
      <Card className="border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent shadow-lg shadow-purple-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI Chef Mode
          </CardTitle>
          <CardDescription>
            Tell us what's in your fridge, and our AI will craft the perfect recipes for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea 
            placeholder="e.g. chicken breast, broccoli, rice, garlic..."
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            className="min-h-[100px] border-purple-500/20 focus-visible:ring-purple-500"
          />
          
          <Button 
            className="w-full bg-purple-600 hover:bg-purple-700 text-white" 
            onClick={handleGenerate}
            disabled={suggestMutation.isPending || !ingredients.trim()}
          >
            {suggestMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gathering Inspiration...</>
            ) : (
              <><ChefHat className="mr-2 h-4 w-4" /> Find Recipes</>
            )}
          </Button>

          {suggestMutation.data && suggestMutation.data.callsRemaining !== 9999 && (
             <p className="text-xs text-center text-muted-foreground">
               {5 - suggestMutation.data.callsRemaining} of 5 daily AI requests used
             </p>
          )}
        </CardContent>
      </Card>

      {/* Suggested Recipes */}
      {suggestMutation.data?.recipes && (
        <div className="grid lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
          {suggestMutation.data.recipes.map((recipe: any, idx: number) => (
            <Card key={idx} className="flex flex-col h-full hover:shadow-xl transition-shadow border-t-4 border-t-purple-500">
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">
                    {recipe.cuisineType}
                  </Badge>
                  <Badge variant={recipe.difficulty === 'easy' ? 'default' : 'secondary'}>
                    {recipe.difficulty}
                  </Badge>
                </div>
                <CardTitle className="line-clamp-2">{recipe.name}</CardTitle>
                <CardDescription className="line-clamp-3">{recipe.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4"/> {recipe.estimatedTime}m</span>
                  <span className="flex items-center gap-1"><Utensils className="w-4 h-4"/> {recipe.servings} servings</span>
                </div>

                {recipe.nutrition && (
                  <div className="p-3 rounded-lg bg-muted/50 text-xs flex justify-between">
                    <span>🔥 {recipe.nutrition.calories}cal</span>
                    <span>🥩 {recipe.nutrition.protein}</span>
                    <span>🍞 {recipe.nutrition.carbs}</span>
                    <span>🥑 {recipe.nutrition.fat}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Ingredients</h4>
                  <ul className="text-sm space-y-1">
                    {recipe.ingredients.map((ing: any, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        {ing.inPantry ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                        <span className={ing.inPantry ? "" : "text-muted-foreground"}>
                          {ing.amount} {ing.unit} {ing.item} {!ing.inPantry && <span className="text-[10px] uppercase ml-1 opacity-60">(missing)</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-2 pt-0 mt-auto">
                <Button variant="outline" className="w-full gap-2">
                  <ShoppingCart className="w-4 h-4" /> Add Missing to List
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <AILimitModal open={showLimitModal} onOpenChange={setShowLimitModal} />
    </div>
  );
}

// Ensure the Utensils & ShoppingCart icon import is present if not
import { Utensils, ShoppingCart } from "lucide-react";
