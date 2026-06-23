import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and } from "drizzle-orm";
import {
  users, households, recipes, weeklyPlans, pantryStaples,
  shoppingListItems, userTasteProfile,
} from "../shared/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// Test account username comes from env so no credential literal ships in the repo.
const TEST_USERNAME = process.env.SEED_TEST_USERNAME;
if (!TEST_USERNAME) {
  console.error("❌ Set SEED_TEST_USERNAME (the seed/test account username) in your .env before running this script.");
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMondayOfWeek(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function ing(name: string, amount: number, unit: string, category = "other") {
  return { name, amount, unit, category };
}

// ── Recipe data ───────────────────────────────────────────────────────────────

const RECIPES = [
  {
    name: "Classic Beef Tacos",
    cuisine: "tex-mex",
    mealType: "dinner",
    difficulty: "easy",
    prepTime: 15,
    cookTime: 20,
    servings: 4,
    tags: JSON.stringify(["quick"]),
    ingredients: JSON.stringify([
      ing("ground beef", 1, "lb", "protein"),
      ing("taco seasoning", 1, "packet", "pantry"),
      ing("flour tortillas", 8, "pieces", "grains"),
      ing("shredded cheddar", 1, "cup", "dairy"),
      ing("romaine lettuce", 2, "cups", "produce"),
      ing("tomato", 1, "medium", "produce"),
      ing("sour cream", 0.5, "cup", "dairy"),
      ing("lime", 1, "whole", "produce"),
    ]),
    instructions: JSON.stringify([
      "Heat a large skillet over medium-high heat.",
      "Add ground beef and cook, breaking it up, until no longer pink — about 8 minutes. Drain excess fat.",
      "Stir in taco seasoning and 2/3 cup water. Simmer 3 minutes until sauce thickens.",
      "Warm tortillas in a dry pan or microwave for 20 seconds.",
      "Assemble tacos with beef, cheese, lettuce, and tomato.",
      "Serve with sour cream and a squeeze of lime.",
    ]),
  },
  {
    name: "Chicken Alfredo Pasta",
    cuisine: "italian",
    mealType: "dinner",
    difficulty: "medium",
    prepTime: 10,
    cookTime: 25,
    servings: 4,
    tags: JSON.stringify(["one-pan"]),
    ingredients: JSON.stringify([
      ing("fettuccine", 12, "oz", "grains"),
      ing("chicken breast", 1, "lb", "protein"),
      ing("heavy cream", 1, "cup", "dairy"),
      ing("parmesan cheese", 1, "cup", "dairy"),
      ing("butter", 3, "tbsp", "dairy"),
      ing("garlic", 3, "cloves", "produce"),
      ing("salt", 1, "tsp", "pantry"),
      ing("black pepper", 0.5, "tsp", "pantry"),
      ing("fresh parsley", 2, "tbsp", "produce"),
    ]),
    instructions: JSON.stringify([
      "Cook fettuccine in salted boiling water until al dente. Reserve 1 cup pasta water before draining.",
      "Season chicken with salt and pepper. Cook in a large skillet over medium-high heat, 6 minutes per side, until cooked through. Slice and set aside.",
      "In the same skillet, melt butter over medium heat. Add garlic and cook 1 minute.",
      "Pour in heavy cream and bring to a gentle simmer. Cook 3 minutes until slightly thickened.",
      "Remove from heat and stir in parmesan until melted. Add a splash of pasta water if too thick.",
      "Toss in pasta and sliced chicken. Season to taste.",
      "Garnish with parsley and extra parmesan before serving.",
    ]),
  },
  {
    name: "Sheet Pan Salmon with Vegetables",
    cuisine: "mediterranean",
    mealType: "dinner",
    difficulty: "easy",
    prepTime: 10,
    cookTime: 20,
    servings: 2,
    tags: JSON.stringify(["quick", "one-pan"]),
    ingredients: JSON.stringify([
      ing("salmon fillets", 2, "pieces", "protein"),
      ing("broccoli", 2, "cups", "produce"),
      ing("cherry tomatoes", 1, "cup", "produce"),
      ing("olive oil", 3, "tbsp", "pantry"),
      ing("lemon", 1, "whole", "produce"),
      ing("garlic", 2, "cloves", "produce"),
      ing("fresh dill", 1, "tbsp", "produce"),
      ing("salt", 1, "tsp", "pantry"),
      ing("black pepper", 0.5, "tsp", "pantry"),
    ]),
    instructions: JSON.stringify([
      "Preheat oven to 425°F. Line a sheet pan with foil.",
      "Toss broccoli and cherry tomatoes with 2 tbsp olive oil, salt, and pepper. Spread on sheet pan.",
      "Place salmon fillets on the pan. Drizzle with remaining olive oil, lemon juice, and minced garlic.",
      "Season salmon with dill, salt, and pepper.",
      "Roast 18–20 minutes until salmon flakes easily and vegetables are tender.",
      "Serve immediately with lemon wedges.",
    ]),
  },
  {
    name: "Slow Cooker Pulled Pork",
    cuisine: "american",
    mealType: "dinner",
    difficulty: "easy",
    prepTime: 15,
    cookTime: 480,
    servings: 8,
    tags: JSON.stringify(["crockpot", "slow-cook", "make-ahead", "freezer-friendly"]),
    ingredients: JSON.stringify([
      ing("pork shoulder", 4, "lb", "protein"),
      ing("BBQ sauce", 1, "cup", "condiments"),
      ing("apple cider vinegar", 0.25, "cup", "pantry"),
      ing("brown sugar", 2, "tbsp", "pantry"),
      ing("garlic powder", 1, "tsp", "pantry"),
      ing("onion powder", 1, "tsp", "pantry"),
      ing("smoked paprika", 2, "tsp", "pantry"),
      ing("salt", 1.5, "tsp", "pantry"),
    ]),
    instructions: JSON.stringify([
      "Mix garlic powder, onion powder, smoked paprika, and salt. Rub all over pork shoulder.",
      "Place pork in slow cooker. Mix BBQ sauce, apple cider vinegar, and brown sugar; pour over pork.",
      "Cook on LOW for 8 hours or HIGH for 4–5 hours until fork-tender.",
      "Remove pork and shred with two forks, discarding excess fat.",
      "Return shredded pork to cooker and toss with juices.",
      "Serve on buns with extra BBQ sauce and coleslaw.",
    ]),
  },
  {
    name: "Chicken Fried Rice",
    cuisine: "asian",
    mealType: "dinner",
    difficulty: "medium",
    prepTime: 15,
    cookTime: 20,
    servings: 4,
    tags: JSON.stringify(["quick", "one-pan"]),
    ingredients: JSON.stringify([
      ing("cooked rice", 3, "cups", "grains"),
      ing("chicken breast", 0.75, "lb", "protein"),
      ing("eggs", 3, "large", "dairy"),
      ing("frozen peas and carrots", 1, "cup", "frozen"),
      ing("soy sauce", 3, "tbsp", "pantry"),
      ing("sesame oil", 1, "tbsp", "pantry"),
      ing("garlic", 3, "cloves", "produce"),
      ing("fresh ginger", 1, "tsp", "produce"),
      ing("green onions", 3, "stalks", "produce"),
    ]),
    instructions: JSON.stringify([
      "Dice chicken into small cubes. Season with salt and pepper.",
      "Heat 1 tbsp oil in a large wok or skillet over high heat. Cook chicken until golden, 5–6 minutes. Remove.",
      "Add frozen vegetables and stir-fry 2 minutes.",
      "Push everything to the sides; scramble eggs in the center until just set.",
      "Add garlic and ginger, stir 30 seconds.",
      "Add cold rice and break up any clumps. Stir-fry 3 minutes until slightly crispy.",
      "Return chicken. Add soy sauce and sesame oil; toss everything together.",
      "Garnish with sliced green onions.",
    ]),
  },
  {
    name: "Homemade Beef Chili",
    cuisine: "american",
    mealType: "dinner",
    difficulty: "easy",
    prepTime: 15,
    cookTime: 45,
    servings: 6,
    tags: JSON.stringify(["one-pot", "make-ahead", "freezer-friendly"]),
    ingredients: JSON.stringify([
      ing("ground beef", 1.5, "lb", "protein"),
      ing("kidney beans", 2, "cans", "pantry"),
      ing("black beans", 1, "can", "pantry"),
      ing("diced tomatoes", 2, "cans", "pantry"),
      ing("tomato paste", 2, "tbsp", "pantry"),
      ing("beef broth", 1, "cup", "pantry"),
      ing("chili powder", 2, "tbsp", "pantry"),
      ing("cumin", 1, "tsp", "pantry"),
      ing("garlic", 4, "cloves", "produce"),
      ing("yellow onion", 1, "medium", "produce"),
    ]),
    instructions: JSON.stringify([
      "Brown ground beef in a large pot over medium-high heat. Drain fat.",
      "Add diced onion and garlic; cook 3 minutes until softened.",
      "Stir in chili powder, cumin, and tomato paste; cook 1 minute.",
      "Add diced tomatoes, beans, beef broth, and 1/2 cup water. Stir well.",
      "Bring to a boil, then reduce to a simmer. Cook uncovered 30–35 minutes, stirring occasionally.",
      "Season with salt and pepper. Serve with sour cream, shredded cheese, and cornbread.",
    ]),
  },
  {
    name: "Margherita Flatbread Pizza",
    cuisine: "italian",
    mealType: "dinner",
    difficulty: "easy",
    prepTime: 10,
    cookTime: 15,
    servings: 2,
    tags: JSON.stringify(["quick"]),
    ingredients: JSON.stringify([
      ing("flatbread", 2, "pieces", "grains"),
      ing("marinara sauce", 0.5, "cup", "pantry"),
      ing("fresh mozzarella", 4, "oz", "dairy"),
      ing("cherry tomatoes", 0.5, "cup", "produce"),
      ing("fresh basil", 0.25, "cup", "produce"),
      ing("olive oil", 1, "tbsp", "pantry"),
      ing("garlic", 1, "clove", "produce"),
      ing("salt", 0.5, "tsp", "pantry"),
    ]),
    instructions: JSON.stringify([
      "Preheat oven to 425°F.",
      "Brush flatbreads with olive oil and rub with cut garlic clove.",
      "Spread marinara sauce evenly over each flatbread.",
      "Tear mozzarella into pieces and scatter over sauce.",
      "Halve cherry tomatoes and place on top.",
      "Bake 12–15 minutes until edges are golden and cheese bubbles.",
      "Top with fresh basil and a drizzle of olive oil. Season with salt.",
    ]),
  },
  {
    name: "Greek Chicken Bowl",
    cuisine: "mediterranean",
    mealType: "lunch",
    difficulty: "easy",
    prepTime: 20,
    cookTime: 15,
    servings: 2,
    tags: JSON.stringify(["make-ahead", "quick"]),
    ingredients: JSON.stringify([
      ing("chicken breast", 0.75, "lb", "protein"),
      ing("cucumber", 1, "medium", "produce"),
      ing("cherry tomatoes", 1, "cup", "produce"),
      ing("kalamata olives", 0.25, "cup", "pantry"),
      ing("red onion", 0.25, "medium", "produce"),
      ing("feta cheese", 3, "oz", "dairy"),
      ing("tzatziki", 0.5, "cup", "dairy"),
      ing("pita bread", 2, "pieces", "grains"),
      ing("olive oil", 2, "tbsp", "pantry"),
      ing("lemon", 1, "whole", "produce"),
    ]),
    instructions: JSON.stringify([
      "Season chicken with olive oil, lemon juice, oregano, salt, and pepper.",
      "Grill or pan-sear chicken over medium-high heat, 5–6 minutes per side. Let rest 5 minutes, then slice.",
      "Dice cucumber and halve cherry tomatoes. Thinly slice red onion.",
      "Warm pita bread in a dry skillet for 1 minute per side.",
      "Build bowls: layer vegetables, sliced chicken, olives, and crumbled feta.",
      "Drizzle with tzatziki and an extra squeeze of lemon.",
    ]),
  },
  {
    name: "Chicken Tortilla Soup",
    cuisine: "tex-mex",
    mealType: "dinner",
    difficulty: "easy",
    prepTime: 10,
    cookTime: 30,
    servings: 6,
    tags: JSON.stringify(["one-pot", "make-ahead", "freezer-friendly"]),
    ingredients: JSON.stringify([
      ing("chicken breast", 1, "lb", "protein"),
      ing("black beans", 1, "can", "pantry"),
      ing("corn", 1, "cup", "produce"),
      ing("diced tomatoes", 1, "can", "pantry"),
      ing("chicken broth", 4, "cups", "pantry"),
      ing("cream cheese", 4, "oz", "dairy"),
      ing("taco seasoning", 1, "packet", "pantry"),
      ing("lime", 1, "whole", "produce"),
      ing("tortilla strips", 1, "cup", "grains"),
      ing("sour cream", 0.25, "cup", "dairy"),
    ]),
    instructions: JSON.stringify([
      "Add chicken breasts, beans, corn, tomatoes, broth, and taco seasoning to a large pot.",
      "Bring to a boil, then reduce heat and simmer 20 minutes.",
      "Remove chicken and shred with two forks. Return to pot.",
      "Add cream cheese in small pieces, stirring until fully melted and incorporated.",
      "Simmer 5 more minutes. Squeeze in lime juice.",
      "Serve topped with tortilla strips, sour cream, and optional cilantro.",
    ]),
  },
  {
    name: "Teriyaki Salmon Bowl",
    cuisine: "asian",
    mealType: "dinner",
    difficulty: "easy",
    prepTime: 10,
    cookTime: 20,
    servings: 2,
    tags: JSON.stringify(["quick"]),
    ingredients: JSON.stringify([
      ing("salmon fillets", 2, "pieces", "protein"),
      ing("soy sauce", 3, "tbsp", "pantry"),
      ing("mirin", 2, "tbsp", "pantry"),
      ing("brown sugar", 1, "tbsp", "pantry"),
      ing("garlic", 2, "cloves", "produce"),
      ing("fresh ginger", 1, "tsp", "produce"),
      ing("jasmine rice", 1, "cup", "grains"),
      ing("broccoli", 2, "cups", "produce"),
      ing("sesame seeds", 1, "tbsp", "pantry"),
      ing("green onions", 2, "stalks", "produce"),
    ]),
    instructions: JSON.stringify([
      "Cook jasmine rice according to package directions.",
      "Mix soy sauce, mirin, brown sugar, garlic, and ginger for the teriyaki sauce.",
      "Steam broccoli until bright green and just tender, about 4 minutes.",
      "Heat a skillet over medium-high heat with a little oil. Place salmon skin-side up; sear 3 minutes.",
      "Flip salmon, pour teriyaki sauce over it, and cook 4–5 more minutes, basting frequently.",
      "Build bowls with rice, broccoli, and glazed salmon.",
      "Drizzle with remaining pan sauce. Top with sesame seeds and green onions.",
    ]),
  },
  {
    name: "Classic American Burger",
    cuisine: "american",
    mealType: "dinner",
    difficulty: "easy",
    prepTime: 10,
    cookTime: 15,
    servings: 4,
    tags: JSON.stringify(["grilled", "quick"]),
    ingredients: JSON.stringify([
      ing("ground beef", 1.5, "lb", "protein"),
      ing("burger buns", 4, "pieces", "grains"),
      ing("cheddar cheese", 4, "slices", "dairy"),
      ing("romaine lettuce", 4, "leaves", "produce"),
      ing("tomato", 1, "large", "produce"),
      ing("yellow onion", 0.5, "medium", "produce"),
      ing("pickles", 8, "slices", "condiments"),
      ing("salt", 1, "tsp", "pantry"),
      ing("black pepper", 0.5, "tsp", "pantry"),
    ]),
    instructions: JSON.stringify([
      "Divide beef into 4 equal portions. Shape into patties slightly wider than the buns. Press a small indent in the center of each.",
      "Season generously with salt and pepper on both sides.",
      "Heat grill or cast iron skillet over high heat. Cook patties 3–4 minutes per side for medium.",
      "Add cheese in the last minute of cooking, cover to melt.",
      "Toast buns cut-side down in the pan for 1 minute.",
      "Assemble with lettuce, tomato, onion, and pickles. Add condiments to taste.",
    ]),
  },
  {
    name: "Chicken Caesar Salad",
    cuisine: "american",
    mealType: "lunch",
    difficulty: "easy",
    prepTime: 15,
    cookTime: 10,
    servings: 2,
    tags: JSON.stringify(["quick"]),
    ingredients: JSON.stringify([
      ing("romaine lettuce", 1, "head", "produce"),
      ing("chicken breast", 0.75, "lb", "protein"),
      ing("parmesan cheese", 0.25, "cup", "dairy"),
      ing("croutons", 1, "cup", "grains"),
      ing("caesar dressing", 3, "tbsp", "condiments"),
      ing("lemon", 0.5, "whole", "produce"),
      ing("black pepper", 0.25, "tsp", "pantry"),
      ing("olive oil", 1, "tbsp", "pantry"),
    ]),
    instructions: JSON.stringify([
      "Season chicken with olive oil, salt, and pepper.",
      "Cook chicken in a skillet over medium-high heat, 5–6 minutes per side. Rest 5 minutes, then slice.",
      "Chop romaine into bite-sized pieces. Wash and spin dry.",
      "In a large bowl, toss lettuce with caesar dressing until evenly coated.",
      "Add sliced chicken, croutons, and shaved parmesan.",
      "Finish with a squeeze of lemon and cracked black pepper.",
    ]),
  },
];

const PANTRY_STAPLES = [
  // Pantry & Dry Goods
  { name: "Olive oil", category: "pantry" },
  { name: "Vegetable oil", category: "pantry" },
  { name: "Salt", category: "pantry" },
  { name: "Black pepper", category: "pantry" },
  { name: "Garlic powder", category: "pantry" },
  { name: "Onion powder", category: "pantry" },
  { name: "Smoked paprika", category: "pantry" },
  { name: "Chili powder", category: "pantry" },
  { name: "Cumin", category: "pantry" },
  { name: "Italian seasoning", category: "pantry" },
  { name: "Soy sauce", category: "pantry" },
  { name: "Hot sauce", category: "pantry" },
  { name: "Jasmine rice", category: "grains" },
  { name: "Fettuccine pasta", category: "grains" },
  { name: "Penne pasta", category: "grains" },
  { name: "Canned diced tomatoes", category: "pantry" },
  { name: "Chicken broth", category: "pantry" },
  { name: "Beef broth", category: "pantry" },
  { name: "Flour tortillas", category: "grains" },
  // Fridge staples
  { name: "Butter", category: "dairy" },
  { name: "Eggs", category: "dairy" },
  { name: "Garlic (fresh)", category: "produce" },
  { name: "Lemons", category: "produce" },
];

const SHOPPING_ITEMS = [
  { name: "Ground beef", amount: "2", unit: "lbs", category: "protein", source: "plan" },
  { name: "Chicken breast", amount: "3", unit: "lbs", category: "protein", source: "plan" },
  { name: "Salmon fillets", amount: "1", unit: "lb", category: "protein", source: "plan" },
  { name: "Pork shoulder", amount: "4", unit: "lbs", category: "protein", source: "plan" },
  { name: "Heavy cream", amount: "1", unit: "pint", category: "dairy", source: "plan" },
  { name: "Parmesan cheese", amount: "8", unit: "oz", category: "dairy", source: "plan" },
  { name: "Shredded cheddar", amount: "8", unit: "oz", category: "dairy", source: "plan" },
  { name: "Feta cheese", amount: "6", unit: "oz", category: "dairy", source: "plan" },
  { name: "Romaine lettuce", amount: "1", unit: "head", category: "produce", source: "plan" },
  { name: "Broccoli", amount: "2", unit: "heads", category: "produce", source: "plan" },
  { name: "Cherry tomatoes", amount: "1", unit: "pint", category: "produce", source: "plan" },
  { name: "Limes", amount: "4", unit: "whole", category: "produce", source: "plan" },
  { name: "Fresh basil", amount: "1", unit: "bunch", category: "produce", source: "plan" },
  { name: "Kidney beans", amount: "2", unit: "cans", category: "pantry", source: "plan" },
  { name: "Black beans", amount: "2", unit: "cans", category: "pantry", source: "plan" },
  { name: "BBQ sauce", amount: "1", unit: "bottle", category: "condiments", source: "plan" },
  { name: "Sesame oil", amount: "1", unit: "bottle", category: "pantry", source: "plan" },
  { name: "Taco seasoning", amount: "2", unit: "packets", category: "pantry", source: "plan" },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Simmer seed script starting...\n");

  // 1. Find the test user
  const userRows = await db.select().from(users).where(eq(users.username, TEST_USERNAME));
  if (userRows.length === 0) {
    console.error(`❌ No user with username '${TEST_USERNAME}' found. Create the account first via the app.`);
    process.exit(1);
  }
  const user = userRows[0];
  const householdId = user.householdId;
  if (!householdId) {
    console.error(`❌ ${TEST_USERNAME} has no household. Complete onboarding first.`);
    process.exit(1);
  }
  console.log(`✓ Found ${TEST_USERNAME} (userId=${user.id}, householdId=${householdId})\n`);

  // 2. Recipes — idempotent: skip existing by name
  const existingRecipes = await db.select({ name: recipes.name }).from(recipes)
    .where(eq(recipes.householdId, householdId));
  const existingNames = new Set(existingRecipes.map(r => r.name));

  const newRecipes = RECIPES.filter(r => !existingNames.has(r.name));
  let insertedRecipes = 0;
  const recipeIdMap: Record<string, number> = {};

  // Load all recipes (including existing) to build the id map for the plan
  for (const recipe of RECIPES) {
    const existing = await db.select({ id: recipes.id, name: recipes.name })
      .from(recipes)
      .where(and(eq(recipes.householdId, householdId), eq(recipes.name, recipe.name)));
    if (existing.length > 0) {
      recipeIdMap[recipe.name] = existing[0].id;
    }
  }

  for (const recipe of newRecipes) {
    const [row] = await db.insert(recipes).values({
      householdId,
      name: recipe.name,
      cuisine: recipe.cuisine as any,
      mealType: recipe.mealType,
      difficulty: recipe.difficulty as any,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      servings: recipe.servings,
      tags: recipe.tags,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      isProcessed: true,
    }).returning({ id: recipes.id });
    recipeIdMap[recipe.name] = row.id;
    insertedRecipes++;
  }
  console.log(`✓ Recipes: ${insertedRecipes} inserted, ${RECIPES.length - insertedRecipes} already existed`);

  // 3. Weekly plan
  const weekStart = getMondayOfWeek();
  const planSlots: Record<string, number> = {
    mon_lunch:   recipeIdMap["Greek Chicken Bowl"],
    mon_dinner:  recipeIdMap["Classic Beef Tacos"],
    tue_lunch:   recipeIdMap["Chicken Caesar Salad"],
    tue_dinner:  recipeIdMap["Chicken Alfredo Pasta"],
    wed_dinner:  recipeIdMap["Sheet Pan Salmon with Vegetables"],
    thu_dinner:  recipeIdMap["Homemade Beef Chili"],
    fri_dinner:  recipeIdMap["Chicken Fried Rice"],
    sat_lunch:   recipeIdMap["Classic American Burger"],
    sat_dinner:  recipeIdMap["Slow Cooker Pulled Pork"],
    sun_dinner:  recipeIdMap["Chicken Tortilla Soup"],
  };

  const existingPlan = await db.select().from(weeklyPlans)
    .where(and(eq(weeklyPlans.householdId, householdId), eq(weeklyPlans.weekStart, weekStart)));

  if (existingPlan.length === 0) {
    await db.insert(weeklyPlans).values({
      householdId,
      weekStart,
      meals: JSON.stringify(planSlots),
    });
    console.log(`✓ Weekly plan: created for week of ${weekStart} (${Object.keys(planSlots).length} slots)`);
  } else {
    console.log(`✓ Weekly plan: already exists for ${weekStart}, skipped`);
  }

  // 4. Pantry staples — skip existing by name
  const existingPantry = await db.select({ name: pantryStaples.name }).from(pantryStaples)
    .where(eq(pantryStaples.householdId, householdId));
  const existingPantryNames = new Set(existingPantry.map(p => p.name));
  const newPantry = PANTRY_STAPLES.filter(p => !existingPantryNames.has(p.name));

  if (newPantry.length > 0) {
    await db.insert(pantryStaples).values(
      newPantry.map(p => ({ householdId, name: p.name, category: p.category }))
    );
  }
  console.log(`✓ Pantry: ${newPantry.length} inserted, ${PANTRY_STAPLES.length - newPantry.length} already existed`);

  // 5. Shopping list items — skip existing by name
  const existingShopping = await db.select({ name: shoppingListItems.name }).from(shoppingListItems)
    .where(eq(shoppingListItems.householdId, householdId));
  const existingShoppingNames = new Set(existingShopping.map(s => s.name));
  const newShopping = SHOPPING_ITEMS.filter(s => !existingShoppingNames.has(s.name));

  if (newShopping.length > 0) {
    await db.insert(shoppingListItems).values(
      newShopping.map(s => ({
        householdId,
        addedBy: user.id,
        name: s.name,
        amount: s.amount,
        unit: s.unit,
        category: s.category,
        checked: false,
        source: s.source,
      }))
    );
  }
  console.log(`✓ Shopping list: ${newShopping.length} inserted, ${SHOPPING_ITEMS.length - newShopping.length} already existed`);

  // 6. Taste profile
  await db.insert(userTasteProfile).values({
    userId: user.id,
    cookingMode: "quick",
    likedCuisines: ["american", "tex-mex", "italian", "asian"],
    dislikedCuisines: [],
    likedIngredients: ["chicken", "garlic", "lemon"],
    dislikedIngredients: ["cilantro"],
    ingredientSubstitutions: {},
    cuisineSignals: {},
    complexityPreference: "medium",
    preferredMealTypes: ["dinner", "lunch"],
  }).onConflictDoUpdate({
    target: userTasteProfile.userId,
    set: {
      cookingMode: "quick",
      likedCuisines: ["american", "tex-mex", "italian", "asian"],
      dislikedCuisines: [],
      likedIngredients: ["chicken", "garlic", "lemon"],
      dislikedIngredients: ["cilantro"],
    },
  });
  console.log(`✓ Taste profile: upserted`);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Simmer seed complete ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Recipes inserted:       ${insertedRecipes} / ${RECIPES.length}
  Weekly plan slots:      ${Object.keys(planSlots).length} (${weekStart})
  Pantry staples added:   ${newPantry.length} / ${PANTRY_STAPLES.length}
  Shopping items added:   ${newShopping.length} / ${SHOPPING_ITEMS.length}
  Taste profile:          upserted
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  await pool.end();
}

main().catch(err => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
