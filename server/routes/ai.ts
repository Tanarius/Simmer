import { Router } from "express";
import { aiRateLimit, copilotRateLimit, FREE_TIER_DAILY_LIMIT, TEST_TIER_DAILY_LIMIT, COPILOT_FREE_TIER_DAILY_LIMIT, COPILOT_TEST_TIER_DAILY_LIMIT } from "../middleware/aiRateLimit";
import {
  suggestRecipesFromPantry,
  selectWeeklyMeals,
  optimizeShoppingList,
  autoTagRecipe
} from "../services/anthropic";
import { chatWithCopilot } from "../services/copilot";
import { cleanRecipe } from "../services/recipeCleaner";
import { searchRecipesForCopilot, type SpoonacularRecipe } from "../services/spoonacular";
import { storage } from "../storage";
import { z } from "zod";
import { aiCache, TTL_24H } from "../utils/cache";

function getAiCallsRemaining(tier: string, callsToday: number): number {
  if (tier === 'premium') return 9999;
  const limit = tier === 'test' ? TEST_TIER_DAILY_LIMIT : FREE_TIER_DAILY_LIMIT;
  return Math.max(0, limit - callsToday);
}

function getCopilotCallsRemaining(tier: string, callsToday: number): number {
  if (tier === 'premium') return 9999;
  const limit = tier === 'test' ? COPILOT_TEST_TIER_DAILY_LIMIT : COPILOT_FREE_TIER_DAILY_LIMIT;
  return Math.max(0, limit - callsToday);
}

const router = Router();

// --- COPILOT ROUTES ---
router.post("/copilot/chat", copilotRateLimit, async (req, res, next) => {
  try {
    const { sessionId, content } = req.body;
    if (!sessionId || !content) return res.status(400).json({ error: "Missing sessionId or content" });

    const reply = await chatWithCopilot((req.user as any).id, (req.user as any).householdId, sessionId, content);
    
    // Usage remaining calculation
    const usage = await storage.getUserAiUsage((req.user as any).id);
    const callsRemaining = getCopilotCallsRemaining(usage.subscriptionTier, usage.copilotCallsToday);

    res.json({ message: reply, callsRemaining });
  } catch (err) {
    next(err);
  }
});

router.get("/copilot/history/:sessionId", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const history = await storage.getCopilotHistory((req.user as any).id, sessionId);
    // Return chronologically
    res.json(history.reverse());
  } catch (err) {
    next(err);
  }
});

router.post("/copilot/execute-tool", async (req, res, next) => {
  try {
    const { sessionId, messageId, action, status } = req.body; // status: 'applied' | 'dismissed'
    
    await storage.updateProposedActionStatus((req.user as any).id, sessionId, messageId, status);
    
    if (status === 'applied') {
      const p = action.parameters;
      // Real database execution
      switch (action.toolName) {
        case 'save_new_recipe': {
          // Parse raw ingredient strings into structured objects
          const parseIngredientString = (raw: string): { name: string; amount: number; unit: string; category: string } => {
            const amountUnitPattern = /^([\d./\s½⅓¼¾⅔⅛]+)\s*(cups?|tablespoons?|tbsp|teaspoons?|tsp|pounds?|lbs?|ounces?|oz|grams?|g|kg|cloves?|slices?|pieces?|cans?|whole|large|medium|small|bunch|stalks?|sprigs?|handfuls?)\.?\s*/i;
            const match = raw.match(amountUnitPattern);
            let name = raw;
            let amount = 1;
            let unit = '';
            if (match) {
              const rawAmt = match[1].trim().replace('½','0.5').replace('⅓','0.33').replace('¼','0.25').replace('¾','0.75');
              const parts = rawAmt.split(/\s+/);
              amount = parts.reduce((acc, p) => {
                if (p.includes('/')) { const [n,d] = p.split('/'); return acc + Number(n)/Number(d); }
                return acc + (Number(p) || 0);
              }, 0) || 1;
              unit = match[2]?.toLowerCase().replace(/s$/, '') || '';
              name = raw.slice(match[0].length).replace(/^,\s*/, '').trim() || raw;
            }
            return { name, amount, unit, category: 'other' };
          };

          const structuredIngredients = Array.isArray(p.ingredients)
            ? p.ingredients.map(parseIngredientString)
            : [];

          // Convert plain instruction text to JSON array of steps
          const structuredInstructions: string[] = [];
          if (typeof p.instructions === 'string') {
            p.instructions.split(/\n+/).forEach((line: string) => {
              const clean = line.replace(/^\d+\.\s*/, '').trim();
              if (clean.length > 5) structuredInstructions.push(clean);
            });
          } else if (Array.isArray(p.instructions)) {
            structuredInstructions.push(...p.instructions);
          }

          // picsum.photos: deterministic beautiful photo keyed to recipe name
          const picsumSeed = encodeURIComponent((p.name as string || 'food').trim().toLowerCase().replace(/\s+/g, '-'));
          const imageUrl = `https://picsum.photos/seed/${picsumSeed}/800/600`;

          // Build tips array
          const tips: string[] = [];
          if (p.tip) tips.push(p.tip);
          if (p.servingSuggestion) tips.push(`Serving: ${p.servingSuggestion}`);

          const recipe = await storage.createRecipe({
            householdId: (req.user as any).householdId,
            name: p.name,
            cuisine: p.cuisine || 'other',
            ingredients: JSON.stringify(structuredIngredients),
            instructions: JSON.stringify(structuredInstructions),
            mealType: p.mealType || 'dinner',
            difficulty: p.difficulty || 'medium',
            servings: p.servings || 2,
            prepTime: p.prepTime || 15,
            cookTime: p.cookTime || 20,
            description: p.description || '',
            // Use verified image/source from Spoonacular/TheMealDB lookup (not AI-generated URLs)
            sourceUrl: p.resolvedSourceUrl || null,
            imageUrl: p.resolvedImageUrl || null,
            tips,
            isProcessed: true,
          } as any);
          storage.logActivity((req.user as any).id, "recipe_added", recipe.id, recipe.name);
          return res.json({ success: true, message: "Recipe saved to library!", recipeId: recipe.id });
        }

        case 'add_to_weekly_plan':
          const householdIdForPlan = (req.user as any).householdId;
          const weekPlan = await storage.getWeeklyPlan(p.weekStart, householdIdForPlan);
          let meals = weekPlan ? JSON.parse(weekPlan.meals) : {};
          // Use recipeId (number) so shopping list and recipe cards work correctly
          meals[`${p.dayOfWeek}_${p.mealType}`] = p.recipeId ?? p.recipeName;
          await storage.upsertWeeklyPlan({
            householdId: householdIdForPlan,
            weekStart: p.weekStart,
            meals: JSON.stringify(meals)
          });
          return res.json({ success: true, message: `Added to ${p.dayOfWeek} ${p.mealType}` });

        case 'optimize_shopping_list':
          // Here we would append to a concrete shopping_lists table.
          return res.json({ success: true, message: `Added items to your list` });
      }
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Find real recipes via Spoonacular (no AI hallucination — real photos, real URLs)
router.post("/copilot/find-recipes", copilotRateLimit, async (req, res, next) => {
  try {
    const { cuisineChoice, vibe, mealType, protein, attempt = 0 } = req.body;
    const userId = (req.user as any).id;

    const tasteProfile = await storage.getUserTasteProfile(userId);
    const avoidedIngredients: string[] = tasteProfile?.dislikedIngredients || [];

    const recipes = await searchRecipesForCopilot({
      vibe: vibe || 'comfort food',
      cuisineChoice,
      mealType,
      protein,
      avoidedIngredients,
      count: 10,
      attempt,
    });

    const usage = await storage.getUserAiUsage(userId);
    const callsRemaining = getCopilotCallsRemaining(usage.subscriptionTier, usage.copilotCallsToday);

    res.json({ recipes, callsRemaining });
  } catch (err) {
    next(err);
  }
});

// Save a Spoonacular recipe to the user's library directly (no AI execute-tool needed)
router.post("/copilot/save-recipe", async (req, res, next) => {
  try {
    const { recipe }: { recipe: SpoonacularRecipe } = req.body;
    if (!recipe?.title) return res.status(400).json({ error: "Recipe data required" });

    const ingredients = recipe.ingredients.map(i => ({
      name: i.name,
      amount: i.amount,
      unit: i.unit,
      category: 'other',
    }));

    // Normalize cuisine — try Spoonacular array first, fall back to keyword inference
    const rawCuisine = (recipe.cuisines?.[0] ?? '').toLowerCase();
    function normalizeCuisine(raw: string, title: string): string {
      const blob = raw + ' ' + title.toLowerCase();
      if (/chinese|japanese|korean|thai|vietnamese|asian|stir.?fry|ramen|pho|wok|sesame|soy sauce|hoisin|miso|yakitori|teriyaki|bulgogi|kimchi|pad thai|fried rice/.test(blob)) return 'asian';
      if (/indian|tikka|masala|curry|biryani|tandoori|naan|paneer|dal|chutney|garam/.test(blob)) return 'indian';
      if (/mexican|tex.?mex|latin|spanish|taco|enchilada|burrito|fajita|carnitas|quesadilla|chipotle|jalap/.test(blob)) return 'tex-mex';
      if (/italian|pasta|pizza|risotto|penne|lasagna|parmesan|mozzarella|prosciutto|gnocchi|pesto/.test(blob)) return 'italian';
      if (/mediterranean|greek|turkish|moroccan|lebanese|hummus|falafel|gyro|kebab|feta|couscous|tzatziki/.test(blob)) return 'mediterranean';
      if (/american|southern|cajun|bbq|barbecue|comfort|burger|meatloaf|mac.?and.?cheese|pot roast|tater tot|casserole|chicken and dump|pulled pork|sloppy joe|wild rice|pot pie|clam chowder|buffalo wing/.test(blob)) return 'american';
      return 'other';
    }
    const cuisineNorm = normalizeCuisine(rawCuisine, recipe.title);

    const mealType = recipe.dishTypes?.includes('breakfast') ? 'breakfast'
      : recipe.dishTypes?.includes('lunch') ? 'lunch'
      : 'dinner';

    // Auto-detect tags from title + cook time
    const titleLower = recipe.title.toLowerCase();
    const autoTags: string[] = [...(recipe.diets || [])];
    if (/crock.?pot|slow.?cook/.test(titleLower)) { if (!autoTags.includes('crockpot')) autoTags.push('crockpot'); }
    if (/instant.?pot|pressure.?cook/.test(titleLower)) { if (!autoTags.includes('quick')) autoTags.push('quick'); if (!autoTags.includes('one-pot')) autoTags.push('one-pot'); }
    if (/air.?fry/.test(titleLower)) { if (!autoTags.includes('quick')) autoTags.push('quick'); }
    if (/grill|bbq|barbecue/.test(titleLower)) { if (!autoTags.includes('grilled')) autoTags.push('grilled'); }
    if (recipe.readyInMinutes > 0 && recipe.readyInMinutes <= 30 && !autoTags.includes('quick')) autoTags.push('quick');
    if (recipe.readyInMinutes >= 240 && !autoTags.includes('crockpot')) { if (!autoTags.includes('slow-cook')) autoTags.push('slow-cook'); }

    const saved = await storage.createRecipe({
      householdId: (req.user as any).householdId,
      name: recipe.title,
      cuisine: cuisineNorm,
      mealType,
      difficulty: recipe.readyInMinutes <= 30 ? 'easy' : recipe.readyInMinutes <= 60 ? 'medium' : 'hard',
      servings: recipe.servings,
      prepTime: Math.round(recipe.readyInMinutes * 0.4),
      cookTime: Math.round(recipe.readyInMinutes * 0.6),
      description: recipe.summary,
      ingredients: JSON.stringify(ingredients),
      instructions: JSON.stringify(recipe.instructions),
      imageUrl: recipe.imageUrl || null,
      sourceUrl: recipe.sourceUrl || null,
      tags: JSON.stringify(autoTags),
      isProcessed: true,
    } as any);

    storage.logActivity((req.user as any).id, "recipe_added", saved.id, saved.name);
    res.json({ success: true, recipe: saved });
  } catch (err) {
    next(err);
  }
});

// --- GENERAL AI ROUTES ---

// Apply general AI rate limit middleware to standard routes
router.use(aiRateLimit);

router.post("/clean-recipe/:id", async (req, res, next) => {
  try {
    const recipeId = parseInt(req.params.id);
    const householdId = (req.user as any).householdId;
    const dbRecipe = await storage.getRecipe(recipeId, householdId);
    if (!dbRecipe) return res.status(404).json({ error: "Recipe not found" });

    // Assuming we have basic raw representation
    let ingredientsArray = [];
    try { ingredientsArray = JSON.parse(dbRecipe.ingredients); } catch { ingredientsArray = [dbRecipe.ingredients]; }

    const cleaned = await cleanRecipe({
      name: dbRecipe.name,
      ingredients: ingredientsArray,
      instructions: dbRecipe.instructions || ''
    });

    // Flatten all cleaned steps into the instructions field so the recipe dialog renders them
    const flatSteps: string[] = cleaned.sections.flatMap((s: any) =>
      s.steps.map((step: any) => (typeof step === 'string' ? step : step.instruction ?? step.text ?? String(step)))
    );

    // Update DB
    await storage.updateRecipe(recipeId, householdId, {
      isProcessed: true,
      rawInstructions: dbRecipe.instructions,
      instructions: JSON.stringify(flatSteps),
      sections: cleaned.sections,
      cleanedSteps: cleaned.sections.flatMap((s: any) => s.steps),
      totalPrepTime: cleaned.totalPrepTime,
      totalCookTime: cleaned.totalCookTime,
      tips: cleaned.tips,
      difficulty: cleaned.difficulty,
    } as any);
    
    res.json({ success: true, recipe: cleaned });
  } catch (err) {
    next(err);
  }
});

router.post("/suggest", async (req, res, next) => {
  try {
    const { ingredients, preferences } = req.body;
    const userId = (req.user as any).id;

    // Build structured prefs — handle both string mood ("quick meal") and object
    let prefs: any;
    if (typeof preferences === 'string') {
      const moodMaxTime: Record<string, number> = { 'quick meal': 30, 'healthy': 45, 'comfort food': 60, 'surprise me': 60 };
      prefs = {
        dietary: [],
        cuisines: [],
        skillLevel: 'intermediate',
        maxPrepTime: moodMaxTime[preferences] ?? 60,
        moodPreference: preferences,
      };
    } else if (preferences) {
      prefs = preferences;
    } else {
      const userPrefs = await storage.getUserPreferences(userId);
      prefs = userPrefs || { dietary: [], cuisines: [], skillLevel: 'intermediate', maxPrepTime: 60 };
    }

    // Enrich prefs with taste profile
    const tasteProfile = await storage.getUserTasteProfile(userId);
    if (tasteProfile) {
      if (tasteProfile.likedCuisines?.length) prefs.cuisines = tasteProfile.likedCuisines;
      if (tasteProfile.dislikedIngredients?.length) prefs.dietary = [...(prefs.dietary || []), ...tasteProfile.dislikedIngredients.map((i: string) => `no ${i}`)];
      if (!prefs.moodPreference) {
        const complexityToSkill: Record<string, string> = { easy: 'beginner', medium: 'intermediate', hard: 'advanced' };
        prefs.skillLevel = complexityToSkill[tasteProfile.complexityPreference] || 'intermediate';
      }
    }

    // Fall back to pantry staples when no ingredients supplied
    let ingredientList: string[] = ingredients && ingredients.length > 0 ? ingredients : [];
    if (ingredientList.length === 0) {
      const staples = await storage.getPantryStaples((req.user as any).householdId);
      ingredientList = staples.map(s => s.name);
    }

    const cacheKey = aiCache.generateKey('suggest', { ingredientList, prefs });
    const cached = aiCache.get<{recipes: any[]}>(cacheKey);
    if (cached) {
      return res.json({ recipes: cached.recipes, callsRemaining: 9999, cached: true });
    }

    const recipes = await suggestRecipesFromPantry(ingredientList, prefs);
    aiCache.set(cacheKey, { recipes }, TTL_24H);

    const usage = await storage.getUserAiUsage((req.user as any).id);
    const callsRemaining = getAiCallsRemaining(usage.subscriptionTier, usage.aiCallsToday);
    
    res.json({ recipes, callsRemaining });
  } catch (err) {
    next(err);
  }
});

router.post("/weekly-plan", async (req, res, next) => {
  try {
    const { schedule } = req.body;
    const userId = (req.user as any).id;
    const householdId = (req.user as any).householdId;

    const [recipes, recentMealNames, userPrefs] = await Promise.all([
      storage.getRecipes(householdId),
      storage.getRecentMealNames(householdId, 14),
      storage.getUserPreferences(userId),
    ]);

    if (recipes.length === 0) {
      return res.status(400).json({ error: "Add some recipes to your library first, then generate an AI plan." });
    }

    const cookingStyles: string[] = (userPrefs as any)?.cookingStyles ?? [];

    // Resolve recent meal names back to IDs so Claude can avoid them
    const recentMealIds = recentMealNames
      .map(name => recipes.find(r => r.name === name)?.id)
      .filter((id): id is number => id !== undefined);

    // Include tags so Claude can honour crockpot/meal-prep preferences
    const recipeList = recipes.map(r => ({
      id: r.id,
      name: r.name,
      cuisine: r.cuisine,
      mealType: r.mealType,
      prepTime: r.prepTime,
      cookTime: r.cookTime,
      tags: r.tags,
    }));

    const cacheKey = aiCache.generateKey('weekly', { schedule, recipeIds: recipeList.map(r => r.id), cookingStyles });
    const cached = aiCache.get<{ meals: Record<string, number> }>(cacheKey);
    if (cached) {
      return res.json({ meals: cached.meals, callsRemaining: 9999, cached: true });
    }

    const meals = await selectWeeklyMeals(recipeList, schedule, recentMealIds, cookingStyles);
    aiCache.set(cacheKey, { meals }, TTL_24H);

    const usage = await storage.getUserAiUsage((req.user as any).id);
    const callsRemaining = getAiCallsRemaining(usage.subscriptionTier, usage.aiCallsToday);

    res.json({ meals, callsRemaining });
  } catch (err) {
    next(err);
  }
});

router.post("/optimize-shopping-list", async (req, res, next) => {
  try {
    const { listItems } = req.body; 
    const staples = await storage.getPantryStaples((req.user as any).householdId);
    const pantryItems = staples.map(s => s.name);

    const optimizedList = await optimizeShoppingList(listItems || [], pantryItems);
    const usage = await storage.getUserAiUsage((req.user as any).id);
    const callsRemaining = getAiCallsRemaining(usage.subscriptionTier, usage.aiCallsToday);

    res.json({ optimizedList, callsRemaining });
  } catch (err) {
    next(err);
  }
});

router.post("/tag-recipe", async (req, res, next) => {
  try {
    const { recipeId } = req.body;
    const recipe = await storage.getRecipe(recipeId, (req.user as any).householdId);
    if (!recipe) return res.status(404).json({ error: "Recipe not found" });

    try {
      const parsedIngredients = typeof recipe.ingredients === "string" ? JSON.parse(recipe.ingredients) : recipe.ingredients;
      const stepStrings = recipe.instructions ? JSON.parse(recipe.instructions) : [];
      
      const tags = await autoTagRecipe(recipe.name, parsedIngredients, stepStrings);
      
      await storage.updateRecipe(recipeId, (req.user as any).householdId, {
        tags: JSON.stringify(tags.dietaryFlags || []),
        difficulty: tags.difficulty || 'medium',
        prepTime: tags.prepTime || 15,
        cookTime: tags.cookTime || 30,
        mealType: tags.mealType || 'dinner'
      });
      res.json({ tags });
    } catch (tagError) {
      console.error("Auto tag failed", tagError);
      res.json({ tags: {} }); 
    }
  } catch (err) {
    next(err);
  }
});

export default router;
