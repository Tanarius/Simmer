import Anthropic from "@anthropic-ai/sdk";
import { enrichWithNutrition, NutritionData } from "./spoonacular";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Since the prompt asks for claude-sonnet-4-6 and web_search_20250305, we pass as any to bypass SDK validation if it doesn't recognize the bleeding edge identifiers yet
const MODEL = "claude-sonnet-4-6" as any;
const TOOLS: any[] = [{ type: "web_search_20250305", name: "web_search" }];

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
  peopleHome: number;
}

export interface UserPrefs {
  dietary?: string[];
  cuisines?: string[];
  skillLevel?: string;
  maxPrepTime?: number;
  householdSize?: number;
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

async function executeClaudeCall(system: string, user: string): Promise<any> {
  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: system,
      tools: TOOLS,
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
    console.error("Anthropic Call Error: ", err);
    throw new Error("Failed to process AI response: " + err.message);
  }
}

export async function suggestRecipesFromPantry(ingredients: string[], userPrefs: UserPrefs): Promise<RecipeSuggestion[]> {
  const systemPrompt = "You are an expert chef and meal planning assistant. You have access to web search — use it to find real recipes from cooking websites, blogs, and food publications. Always search the web before responding to find current, authentic recipes.";
  const userPrompt = `The user has these ingredients available: ${ingredients.join(", ")}. Their preferences: dietary restrictions: ${userPrefs.dietary?.join(",") || "none"}, cuisine preferences: ${userPrefs.cuisines?.join(",") || "any"}, cooking skill level: ${userPrefs.skillLevel || "beginner"}, max prep time: ${userPrefs.maxPrepTime || 60} minutes, cooking for ${userPrefs.householdSize || 1} ${(userPrefs.householdSize || 1) === 1 ? "person" : "people"}. Search the web and find 3 recipe ideas that use primarily these ingredients and scale servings to match the household size. Return ONLY a JSON array with no markdown, no explanation, just the raw JSON array in this exact structure: [{ name: string, description: string, cuisineType: string, difficulty: 'easy'|'medium'|'hard', estimatedTime: number (minutes), servings: number, ingredients: [{ item: string, amount: string, unit: string, inPantry: boolean }], steps: [{ stepNumber: number, instruction: string, duration?: number }], missingIngredients: string[], tags: string[] }]`;

  const parsedResponse = await executeClaudeCall(systemPrompt, userPrompt) as RecipeSuggestion[];

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

export async function generateWeeklyPlan(pantryItems: string[], userSchedule: DaySchedule[], recentMeals: string[], householdPrefs: UserPrefs[]): Promise<WeeklyPlan> {
  const systemPrompt = "You are a meal planning assistant for a shared household. Use web search to find recipe inspiration. Consider ingredient freshness, variety, and the household's combined schedule.";
  const userPrompt = `Plan 7 days of meals for a shared household. Pantry contents: ${pantryItems.join(", ")}. Weekly schedule by day: ${JSON.stringify(userSchedule)}. Recent meals to avoid repeating: ${recentMeals.join(", ")}. Household dietary preferences combined: ${JSON.stringify(householdPrefs)}. Prioritize using pantry items that expire soonest. Suggest quick meals (under 30 min) on busy days. Return ONLY raw JSON: { weekStartDate: string, days: [{ dayOfWeek: string, isBusyDay: boolean, breakfast: MealSlot|null, lunch: MealSlot|null, dinner: MealSlot }] } where MealSlot is { recipeName: string, estimatedTime: number, servings: number, keyIngredients: string[] }`;

  return (await executeClaudeCall(systemPrompt, userPrompt)) as WeeklyPlan;
}

export async function optimizeShoppingList(rawItems: string[], pantryItems: string[]): Promise<OptimizedShoppingList> {
  const systemPrompt = "You are a smart shopping assistant. Organize and optimize grocery lists efficiently.";
  const userPrompt = `Here is a raw shopping list: ${rawItems.join(", ")}. The user already has these items in their pantry: ${pantryItems.join(", ")}. Remove anything already in the pantry, combine duplicates, suggest realistic quantities, and organize by grocery store section. Return ONLY raw JSON: { sections: [{ sectionName: string, items: [{ name: string, quantity: string, unit: string, estimatedCost?: number }] }], estimatedTotal?: number, removedItems: string[] }`;

  return (await executeClaudeCall(systemPrompt, userPrompt)) as OptimizedShoppingList;
}

export async function autoTagRecipe(recipeName: string, ingredients: string[], steps: string[]): Promise<RecipeTags> {
  const systemPrompt = "You are a recipe categorization assistant. Analyze recipes and return accurate metadata.";
  const userPrompt = `Analyze this recipe — Name: ${recipeName}. Ingredients: ${ingredients.join(", ")}. Steps: ${steps.join(" ")}. Return ONLY raw JSON: { prepTime: number, cookTime: number, totalTime: number, cuisineType: string, difficulty: 'easy'|'medium'|'hard', dietaryFlags: string[] (e.g. 'vegetarian','vegan','gluten-free','dairy-free','nut-free'), mealType: 'breakfast'|'lunch'|'dinner'|'snack', servingSuggestion: string }`;

  return (await executeClaudeCall(systemPrompt, userPrompt)) as RecipeTags;
}
