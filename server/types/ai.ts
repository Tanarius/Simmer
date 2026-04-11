// ─── User & Preferences ───────────────────────────────────────────

export interface UserPrefs {
  dietary: string[];
  cuisines: string[];
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  maxPrepTime: number;
}

// ─── Onboarding ───────────────────────────────────────────────────

export interface OnboardingDish {
  dishName: string;
  cuisineType: string;
  complexity: 'easy' | 'medium' | 'hard';
  mealType: string;
  shortDescription: string;   // max 20 words, taste/texture/vibe — no ingredients
  imageUrl: string;           // from Unsplash API
  searchQuery: string;        // used to fetch the image
}

export interface OnboardingSwipe {
  dishName: string;
  imageUrl: string;
  cuisineType: string;
  complexity: 'easy' | 'medium' | 'hard';
  mealType: string;
  liked: boolean;
}

export interface UserOnboarding {
  id: number;
  userId: number;
  completed: boolean;
  cookingMode: 'cook' | 'eater' | null;
  currentStep: number;
  completedAt: Date | null;
}

// ─── Taste Profile ────────────────────────────────────────────────

export interface TasteProfile {
  dominantCuisines: string[];
  frequentIngredients: string[];
  preferredComplexity: 'easy' | 'medium' | 'hard';
  avgPrepTime: number;
  dietaryPatterns: string[];
  recipeCount: number;
}

export interface UserTasteProfile {
  id: number;
  userId: number;
  cookingMode: 'cook' | 'eater';
  likedCuisines: string[];
  dislikedCuisines: string[];
  likedIngredients: string[];
  dislikedIngredients: string[];
  ingredientSubstitutions: Record<string, string | null>;
  complexityPreference: 'easy' | 'medium' | 'hard';
  preferredMealTypes: string[];
  cuisineSignals: Record<string, number>;
  derivedFrom: number;
  lastUpdated: Date;
}

export interface HouseholdTasteProfile {
  id: number;
  householdId: number;
  memberCount: number;
  sharedCuisines: string[];
  avoidCuisines: string[];
  complexityConsensus: 'easy' | 'medium' | 'hard';
  updatedAt: Date;
}

// ─── Recipe Suggestions ───────────────────────────────────────────

export interface RecipeSuggestion {
  name: string;
  description: string;
  cuisineType: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: number;        // total minutes
  servings: number;
  ingredients: {
    item: string;
    amount: string;
    unit: string;
    inPantry: boolean;          // true if item exists in user's pantry
  }[];
  steps: {
    stepNumber: number;
    instruction: string;
    durationMinutes: number | null;
  }[];
  missingIngredients: string[];
  tags: string[];
  nutrition: NutritionData | null;
}

export interface NutritionData {
  calories: number;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
}

// ─── Recipe Cleaning ──────────────────────────────────────────────

export interface RawRecipe {
  name: string;
  ingredients: string[];
  instructions: string;
}

export interface CleanedRecipe {
  cleanedName: string;
  sections: {
    sectionName: string;        // e.g. 'Make the Sauce', 'Cook the Protein'
                                // use 'Main' if no natural sections exist
    steps: {
      stepNumber: number;       // globally sequential — never resets per section
      instruction: string;
      durationMinutes: number | null;   // extracted from step text if present
      linkedIngredients: string[];      // ingredient names used in this step
    }[];
  }[];
  totalPrepTime: number;        // minutes
  totalCookTime: number;        // minutes
  totalTime: number;            // prepTime + cookTime
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  tips: string[];               // chef notes / variations from original text
}

// ─── Recipe Tags ──────────────────────────────────────────────────

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

// ─── Planning ─────────────────────────────────────────────────────

export interface MealSlot {
  recipeName: string;
  estimatedTime: number;
  servings: number;
  keyIngredients: string[];
}

export interface WeeklyPlan {
  weekStartDate: string;        // ISO date string
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
    sectionName: string;        // e.g. 'Produce', 'Dairy', 'Meat'
    items: {
      name: string;
      quantity: string;
      unit: string;
      estimatedCost?: number;
    }[];
  };
  estimatedTotal?: number;
  removedItems: string[];       // items already in pantry that were removed
}

// ─── Spoonacular ──────────────────────────────────────────────────

export interface SpoonacularNutrition {
  calories: number;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
}

// ─── Copilot ──────────────────────────────────────────────────────

export interface ProposedAction {
  toolName: 'save_new_recipe' | 'add_to_weekly_plan' | 'optimize_shopping_list';
  parameters: Record<string, unknown>;
  displayText: string;          // human-readable description shown in proposal card
  status: 'pending' | 'applied' | 'dismissed';
}

export interface CopilotMessage {
  id?: number;                  // DB row id — present when loaded from history
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;            // ISO string
  proposedAction: ProposedAction | null;
}
