import Anthropic from "@anthropic-ai/sdk";
import { enrichWithNutrition, NutritionData } from "./spoonacular";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "dummy", 
});

const MODEL = "claude-haiku-4-5-20251001";

export interface RecipeSuggestion {
  name: string;
  description: string;
  cuisineType: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: number;
  servings: number;
  ingredients: { item: string; amount: string; unit: string; inPantry: boolean }[];
  steps: { stepNumber: number; instruction: string; duration?: number }[];
  missingIngredients: string[];
  tags: string[];
  nutrition?: NutritionData | null;
}

export interface DaySchedule {
  dayOfWeek: string;
  isBusyDay: boolean;
  isOffDay?: boolean;
  peopleHome: number;
}

export interface UserPrefs {
  dietary?: string[];
  cuisines?: string[];
  skillLevel?: string;
  maxPrepTime?: number;
  moodPreference?: string; // "quick meal" | "healthy" | "comfort food" | "surprise me"
}

export interface MealSlot {
  recipeName: string;
  estimatedTime: number;
  servings: number;
  keyIngredients: string[];
}

export interface WeeklyPlan {
  weekStartDate: string;
  days: {
    dayOfWeek: string;
    isBusyDay: boolean;
    breakfast: MealSlot | null;
    lunch: MealSlot | null;
    dinner: MealSlot;
  }[];
}

export interface OptimizedShoppingList {
  sections: {
    sectionName: string;
    items: { name: string; quantity: string; unit: string; estimatedCost?: number }[];
  }[];
  estimatedTotal?: number;
  removedItems: string[];
}

export interface RecipeTags {
  prepTime: number;
  cookTime: number;
  totalTime: number;
  cuisineType: string;
  difficulty: 'easy' | 'medium' | 'hard';
  dietaryFlags: string[];
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servingSuggestion: string;
}

async function executeClaudeCall(system: string, user: string, maxTokens = 1500): Promise<any> {
  if (!process.env.ANTHROPIC_API_KEY) {
    const e: any = new Error("ANTHROPIC_API_KEY is not configured on the server");
    e.status = 503;
    throw e;
  }
  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: system,
      messages: [{ role: "user", content: user }]
    });

    const textBlock = msg.content.find((block) => block.type === "text") as Anthropic.TextBlock;
    if (!textBlock || !textBlock.text) throw new Error("No text content returned from Anthropic");

    // Clean markdown formatting if present
    let raw = textBlock.text.trim();
    if (raw.startsWith("```json")) {
        raw = raw.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (raw.startsWith("```")) {
        raw = raw.replace(/^```/, "").replace(/```$/, "").trim();
    }

    return JSON.parse(raw);
  } catch (err: any) {
    console.error("Anthropic Call Error:", err?.status, err?.message, err?.error);
    // Surface auth/quota errors as non-500 so the client sees a useful message
    if (err.status === 401) {
      const e: any = new Error("AI service authentication failed â€” check ANTHROPIC_API_KEY");
      e.status = 503;
      throw e;
    }
    if (err.status === 429) {
      const e: any = new Error("AI rate limit reached â€” try again later");
      e.status = 429;
      throw e;
    }
    // Already has a status (our own errors)
    if (err.status) throw err;
    throw new Error("Failed to process AI response: " + err.message);
  }
}

export async function suggestRecipesFromPantry(ingredients: string[], userPrefs: UserPrefs): Promise<RecipeSuggestion[]> {
  const systemPrompt = "You are an expert chef and meal planning assistant. Suggest real, practical recipes based on the ingredients and preferences provided.";
  const moodLine = userPrefs.moodPreference ? `Mood/style: ${userPrefs.moodPreference}. ` : '';
  const userPrompt = `The user has these ingredients available: ${ingredients.join(", ")}. Their preferences: dietary restrictions: ${userPrefs.dietary?.join(",") || "none"}, cuisine preferences: ${userPrefs.cuisines?.join(",") || "any"}, cooking skill level: ${userPrefs.skillLevel || "beginner"}, max prep time: ${userPrefs.maxPrepTime || 60} minutes. ${moodLine}Find 3 recipe ideas that use primarily these ingredients. Return ONLY a JSON array with no markdown, no explanation, just the raw JSON array in this exact structure: [{ name: string, description: string, cuisineType: string, difficulty: 'easy'|'medium'|'hard', estimatedTime: number (minutes), servings: number, ingredients: [{ item: string, amount: string, unit: string, inPantry: boolean }], steps: [{ stepNumber: number, instruction: string, duration?: number }], missingIngredients: string[], tags: string[] }]`;

  // 3 full recipes with steps need headroom â€” 1500 reliably truncates JSON
  const parsedResponse = await executeClaudeCall(systemPrompt, userPrompt, 4096) as RecipeSuggestion[];

  // Run SPOONACULAR in parallel
  const enrichedRecipes = await Promise.allSettled(
    parsedResponse.map(async (recipe) => {
      const ingrStrings = recipe.ingredients.map(i => i.item);
      const nutrition = await enrichWithNutrition(recipe.name, ingrStrings);
      return { ...recipe, nutrition };
    })
  );

  return enrichedRecipes.map(res => res.status === "fulfilled" ? res.value : (res as any).reason);
}

const DAY_ABBR: Record<string, string> = {
  Monday: "mon", Tuesday: "tue", Wednesday: "wed", Thursday: "thu",
  Friday: "fri", Saturday: "sat", Sunday: "sun",
};

export async function selectWeeklyMeals(
  recipes: { id: number; name: string; cuisine: string; mealType: string; prepTime: number | null; cookTime: number | null; tags?: string | null }[],
  schedule: { dayOfWeek: string; isBusyDay: boolean; isOffDay: boolean }[],
  recentMealIds: number[],
  cookingStyles: string[] = [],
): Promise<Record<string, number>> {
  const slots = schedule
    .filter(d => !d.isOffDay)
    .flatMap(d => {
      const abbr = DAY_ABBR[d.dayOfWeek];
      if (!abbr) return [];
      return [
        { key: `${abbr}_lunch`, busy: d.isBusyDay },
        { key: `${abbr}_dinner`, busy: d.isBusyDay },
      ];
    });

  const recipeList = recipes.map(r => {
    let parsedTags: string[] = [];
    try { parsedTags = r.tags ? JSON.parse(r.tags) : []; } catch { /* skip */ }
    return {
      id: r.id,
      name: r.name,
      cuisine: r.cuisine,
      mealType: r.mealType,
      totalTime: (r.prepTime ?? 0) + (r.cookTime ?? 0),
      tags: parsedTags,
    };
  });

  // Build household cooking style rules
  const styleRules: string[] = [];
  const isBatchCook = cookingStyles.includes('meal-prep');
  const isCrockpot = cookingStyles.includes('crockpot');
  const isQuick = cookingStyles.includes('quick') && !cookingStyles.includes('classic');

  if (isBatchCook) {
    styleRules.push('This household MEAL PREPS. Schedule the same recipe ID across 3â€“5 slots â€” they batch cook and portion it across days. Include at least one recipe repeated 3+ times.');
  }
  if (isCrockpot) {
    styleRules.push('This household uses a crockpot. Prioritise recipes whose tags include "crockpot" or "slow-cook" for non-busy days â€” these make large portions great for multiple servings.');
  }
  if (isQuick) {
    styleRules.push('This household prefers quick meals. Strongly prefer recipes with low totalTime throughout the week.');
  }

  const systemPrompt = `You are a meal planning assistant. Select meals ONLY from the provided recipe library â€” never invent new recipes or names. Always return valid recipe IDs from the list.`;

  const userPrompt = `Select recipes from this library to fill the week's meal plan.

Recipe library:
${JSON.stringify(recipeList)}

Fill these slots (key: slot name, busy means prefer totalTime â‰¤ 30):
${slots.map(s => `${s.key}${s.busy ? " (busy â€” prefer â‰¤30 min)" : ""}`).join(", ")}

Rules:
- ONLY use recipe IDs from the library above â€” never invent a recipe
- Vary cuisines and mealTypes throughout the week where possible
- ${isBatchCook ? 'ENCOURAGE repeating recipe IDs (meal prep portioning)' : 'Try not to repeat the same recipe ID more than twice'}
- For busy slots prefer low totalTime; for dinner prefer mealType "dinner" or "either"
- Avoid these recently used recipe IDs if possible: [${recentMealIds.join(", ")}]
${styleRules.map(r => `- ${r}`).join('\n')}

Return ONLY a raw JSON object mapping each slot key to a recipe ID number.
Example: {"mon_lunch": 3, "mon_dinner": 7, "tue_lunch": 12}`;

  const result = await executeClaudeCall(systemPrompt, userPrompt, 400);

  // Validate â€” strip any IDs that don't exist in the library
  const validIds = new Set(recipes.map(r => r.id));
  const cleaned: Record<string, number> = {};
  for (const [key, val] of Object.entries(result)) {
    if (typeof val === "number" && validIds.has(val)) {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

export async function optimizeShoppingList(rawItems: string[], pantryItems: string[]): Promise<OptimizedShoppingList> {
  const systemPrompt = "You are a smart shopping assistant. Organize and optimize grocery lists efficiently.";
  const userPrompt = `Here is a raw shopping list: ${rawItems.join(", ")}. The user already has these items in their pantry: ${pantryItems.join(", ")}. Remove anything already in the pantry, combine duplicates, suggest realistic quantities, and organize by grocery store section. Return ONLY raw JSON: { sections: [{ sectionName: string, items: [{ name: string, quantity: string, unit: string, estimatedCost?: number }] }], estimatedTotal?: number, removedItems: string[] }`;

  return (await executeClaudeCall(systemPrompt, userPrompt)) as OptimizedShoppingList;
}

export async function autoTagRecipe(recipeName: string, ingredients: string[], steps: string[]): Promise<RecipeTags> {
  const systemPrompt = "You are a recipe categorization assistant. Analyze recipes and return accurate metadata.";
  const userPrompt = `Analyze this recipe â€” Name: ${recipeName}. Ingredients: ${ingredients.join(", ")}. Steps: ${steps.join(" ")}. Return ONLY raw JSON: { prepTime: number, cookTime: number, totalTime: number, cuisineType: string, difficulty: 'easy'|'medium'|'hard', dietaryFlags: string[] (e.g. 'vegetarian','vegan','gluten-free','dairy-free','nut-free'), mealType: 'breakfast'|'lunch'|'dinner'|'snack', servingSuggestion: string }`;

  return (await executeClaudeCall(systemPrompt, userPrompt)) as RecipeTags;
}

