import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Loader2, ChefHat, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function PantryChef() {
  const [preferences, setPreferences] = useState("quick meal");
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<any[] | null>(null);

  const suggestMutation = useMutation({
    mutationFn: async (prefs: string) => {
      const res = await apiRequest("POST", "/api/ai/suggest", { 
        ingredients: [], // The backend will actually use the pantry if ingredients is empty in our modified version, but wait: the backend `/api/ai/suggest` expects ingredients array.
        preferences: prefs 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate suggestions");
      return data;
    },
    onSuccess: (data) => {
      setSuggestions(data.recipes);
      toast({
        title: "Chef's Suggestions Ready!",
        description: `Found ${data.recipes.length} ideas. (${data.callsRemaining} suggestions left today)`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    }
  });

  const saveRecipeMutation = useMutation({
    mutationFn: async (recipe: any) => {
      const payload = {
        name: recipe.name,
        description: recipe.description || recipe.reasoning,
        cuisine: recipe.cuisineType || "other",
        mealType: "dinner",
        difficulty: recipe.difficulty || "medium",
        prepTime: recipe.estimatedTime || 15,
        cookTime: 0,
        servings: recipe.servings || 2,
        ingredients: JSON.stringify(recipe.ingredients || []),
        instructions: JSON.stringify(recipe.steps?.map((s: any) => s.instruction) || []),
        isProcessed: false
      };
      const res = await apiRequest("POST", "/api/recipes", payload);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Saved to Library", description: `${data.name} is now available in your Recipes tab.` });
    }
  });

  return (
    <div className="bg-gradient-to-br from-orange-900/30 to-amber-900/30 border border-orange-500/20 rounded-xl p-5 mb-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-orange-100 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-400" />
            Chef Mode
          </h2>
          <p className="text-sm text-orange-200/70 mt-1">Let Simmer suggest what to cook based on your pantry staples and recent taste profile.</p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select 
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            className="flex h-9 w-full md:w-[150px] rounded-md border border-orange-500/30 bg-orange-950/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500 text-orange-100"
          >
            <option value="quick meal">Quick Meal</option>
            <option value="healthy">Healthy</option>
            <option value="comfort food">Comfort Food</option>
            <option value="surprise me">Surprise Me</option>
          </select>
          <Button 
            onClick={() => suggestMutation.mutate(preferences)}
            disabled={suggestMutation.isPending}
            className="bg-[#C96A3A] hover:bg-[#A85530] text-white shadow-md whitespace-nowrap shrink-0"
          >
            {suggestMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ChefHat className="h-4 w-4 mr-2" />}
            Generate
          </Button>
        </div>
      </div>

      {suggestions && suggestions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-black/20 p-4 rounded-lg">
          {suggestions.map((recipe, idx) => (
            <div key={idx} className="bg-card border border-border p-4 rounded-lg flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-foreground leading-tight">{recipe.name}</h3>
                <Badge variant="secondary" className="bg-orange-500/20 text-orange-300 border-none shrink-0">{recipe.matchScore || "Great Match"}</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{recipe.reasoning || recipe.description || "Perfect for your preferences."}</p>
              
              <div className="mt-auto flex justify-between items-center pt-2">
                 <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" /> {recipe.estimatedTime || "30"} min
                 </span>
                 <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-xs border-orange-500/30 hover:bg-orange-500/10"
                    onClick={() => saveRecipeMutation.mutate(recipe)}
                    disabled={saveRecipeMutation.isPending}
                 >
                    Save Recipe
                 </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
