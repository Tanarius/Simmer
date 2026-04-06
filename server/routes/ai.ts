import { Router } from "express";
import { aiRateLimit } from "../middleware/aiRateLimit";
import { 
  suggestRecipesFromPantry, 
  generateWeeklyPlan,
  optimizeShoppingList,
  autoTagRecipe
} from "../services/anthropic";
import { storage } from "../storage";

const router = Router();

// Apply AI rate limit middleware to all AI routes
router.use(aiRateLimit);

router.post("/suggest", async (req, res, next) => {
  try {
    const { ingredients, preferences } = req.body;
    let prefs = preferences;
    if (!prefs) {
       prefs = { dietary: [], cuisines: [], skillLevel: "beginner", maxPrepTime: 60 };
    }

    const recipes = await suggestRecipesFromPantry(ingredients, prefs);
    const usage = await storage.getUserAiUsage(req.user!.id);
    
    const callsRemaining = usage.subscriptionTier === 'premium' ? 9999 : Math.max(0, 5 - usage.aiCallsToday);
    
    res.json({ recipes, callsRemaining });
  } catch (err) {
    next(err);
  }
});

router.post("/weekly-plan", async (req, res, next) => {
  try {
    const { schedule } = req.body;
    const staples = await storage.getPantryStaples();
    const pantryItems = staples.map(s => s.name);
    // Hardcoded recent meals for demo purposes based on prompt constraints
    const recentMeals = ["Spaghetti", "Tacos"]; 
    
    const weeklyPlan = await generateWeeklyPlan(pantryItems, schedule, recentMeals, []);
    const usage = await storage.getUserAiUsage(req.user!.id);
    const callsRemaining = usage.subscriptionTier === 'premium' ? 9999 : Math.max(0, 5 - usage.aiCallsToday);

    res.json({ weeklyPlan, callsRemaining });
  } catch (err) {
    next(err);
  }
});

router.post("/optimize-shopping-list", async (req, res, next) => {
  try {
    const { listItems } = req.body; 
    const staples = await storage.getPantryStaples();
    const pantryItems = staples.map(s => s.name);

    const optimizedList = await optimizeShoppingList(listItems || [], pantryItems);
    
    const usage = await storage.getUserAiUsage(req.user!.id);
    const callsRemaining = usage.subscriptionTier === 'premium' ? 9999 : Math.max(0, 5 - usage.aiCallsToday);

    res.json({ optimizedList, callsRemaining });
  } catch (err) {
    next(err);
  }
});

router.post("/tag-recipe", async (req, res, next) => {
  try {
    const { recipeId } = req.body;
    const recipe = await storage.getRecipe(recipeId);
    if (!recipe) return res.status(404).json({ error: "Recipe not found" });

    try {
      const parsedIngredients = typeof recipe.ingredients === "string" ? JSON.parse(recipe.ingredients) : recipe.ingredients;
      const ingredientStrings = parsedIngredients.map((i: any) => i.name || i);
      const stepStrings = recipe.instructions ? JSON.parse(recipe.instructions) : [];
      
      const tags = await autoTagRecipe(recipe.name, ingredientStrings, stepStrings);
      
      await storage.updateRecipe(recipeId, {
        tags: JSON.stringify(tags.dietaryFlags || []),
        difficulty: tags.difficulty || 'medium',
        prepTime: tags.prepTime || 15,
        cookTime: tags.cookTime || 30,
        mealType: tags.mealType || 'dinner'
      });
      res.json({ tags });
    } catch (tagError) {
      console.error("Auto tag failed, swallowing error gracefully", tagError);
      res.json({ tags: {} }); 
    }
  } catch (err) {
    next(err);
  }
});

export default router;
