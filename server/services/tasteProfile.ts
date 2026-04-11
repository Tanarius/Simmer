import { storage } from "../storage";
import { TasteProfile } from "../types/ai";

/**
 * Derives a macro household TasteProfile by inspecting all saved recipes.
 * This acts as the context core for the Copilot's suggestions.
 */
export async function buildHouseholdTasteProfile(userId: number): Promise<TasteProfile> {
  const recipes = await storage.getRecipes();

  // Aggregate stats
  const cuisineCounts: Record<string, number> = {};
  const ingredientCounts: Record<string, number> = {};
  const difficultyCounts: { easy: number; medium: number; hard: number } = { easy: 0, medium: 0, hard: 0 };
  
  let totalPrepTime = 0;
  let preppedRecipeCount = 0;
  const dietaryFlagsSet = new Set<string>();

  for (const r of recipes) {
    // Cuisine
    const cuisine = r.cuisineType || r.cuisine;
    if (cuisine) cuisineCounts[cuisine] = (cuisineCounts[cuisine] || 0) + 1;

    // Difficulty
    const diff = (r.difficulty || 'medium').toLowerCase();
    if (diff === 'easy') difficultyCounts.easy++;
    else if (diff === 'hard') difficultyCounts.hard++;
    else difficultyCounts.medium++;

    // Prep time
    if (r.prepTime) {
      totalPrepTime += r.prepTime;
      preppedRecipeCount++;
    }

    // Dietary
    if (r.dietaryFlags && Array.isArray(r.dietaryFlags)) {
      for (const flag of r.dietaryFlags) dietaryFlagsSet.add(flag);
    }

    // Ingredients
    let ingredientsList: any[] = [];
    try {
      ingredientsList = typeof r.ingredients === 'string' ? JSON.parse(r.ingredients) : r.ingredients;
    } catch (e) {
      continue; // Skip unparseable
    }

    if (!Array.isArray(ingredientsList)) continue;

    for (const item of ingredientsList) {
      let name = '';
      if (typeof item === 'string') name = item;
      else if (item && typeof item === 'object') {
        name = item.name || item.item || '';
      }
      
      if (!name || typeof name !== 'string') continue;
      
      const lower = name.toLowerCase().trim();
      // Extremely naive matching — skipping standard kitchen commodities that don't indicate taste
      const skipWords = ['salt', 'pepper', 'water', 'oil', 'butter'];
      if (skipWords.some(w => lower.includes(w))) continue;
      
      ingredientCounts[lower] = (ingredientCounts[lower] || 0) + 1;
    }
  }

  // Derive top 3 cuisines
  const cuisinesSorted = Object.keys(cuisineCounts).sort((a, b) => cuisineCounts[b] - cuisineCounts[a]);
  const dominantCuisines = cuisinesSorted.slice(0, 3);

  // Derive most active ingredients
  const ingredientsSorted = Object.keys(ingredientCounts)
    .sort((a, b) => ingredientCounts[b] - ingredientCounts[a]);
  const frequentIngredients = ingredientsSorted.slice(0, 10);

  // Derive preferred complexity (mode)
  let preferredComplexity: 'easy' | 'medium' | 'hard' = 'medium';
  if (difficultyCounts.easy > difficultyCounts.medium && difficultyCounts.easy > difficultyCounts.hard) {
    preferredComplexity = 'easy';
  } else if (difficultyCounts.hard > difficultyCounts.medium && difficultyCounts.hard > difficultyCounts.easy) {
    preferredComplexity = 'hard';
  }

  // Averages
  const avgPrepTime = preppedRecipeCount > 0 ? Math.round(totalPrepTime / preppedRecipeCount) : 30;

  return {
    dominantCuisines: dominantCuisines.length ? dominantCuisines : ['American'], // fallback
    frequentIngredients,
    preferredComplexity,
    avgPrepTime,
    dietaryPatterns: Array.from(dietaryFlagsSet),
    recipeCount: recipes.length
  };
}
