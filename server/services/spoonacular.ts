import axios from "axios";

export interface NutritionData {
  calories: number;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
}

export async function enrichWithNutrition(recipeName: string, ingredients: string[]): Promise<NutritionData | null> {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    console.warn("SPOONACULAR_API_KEY is not set, skipping nutrition enrichment.");
    return null;
  }

  try {
    const ingredientsQuery = ingredients.join(',');
    const searchRes = await axios.get(`https://api.spoonacular.com/recipes/findByIngredients`, {
      params: { ingredients: ingredientsQuery, number: 1, apiKey }
    });

    if (!searchRes.data || searchRes.data.length === 0) {
      return null;
    }

    const recipeId = searchRes.data[0].id;
    const nutritionRes = await axios.get(`https://api.spoonacular.com/recipes/${recipeId}/nutritionWidget.json`, {
      params: { apiKey }
    });

    const data = nutritionRes.data;
    const calories = data.calories ? parseInt(data.calories) : 0;
    const protein = data.protein || '0g';
    const carbs = data.carbs || '0g';
    const fat = data.fat || '0g';
    
    // Fiber is usually in the "good" array in Spoonacular's widget
    const fiberObj = data.good?.find((n: any) => n.title === 'Fiber');
    const fiber = fiberObj ? fiberObj.amount : '0g';

    return { calories, protein, carbs, fat, fiber };
  } catch (error) {
    console.error("Spoonacular enrichment failed, skipping:", error);
    return null; // Always fail gracefully
  }
}
