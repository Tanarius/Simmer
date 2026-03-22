import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { recipes, weeklyPlans, pantryStaples } from "@shared/schema";
import type { Recipe, InsertRecipe, WeeklyPlan, InsertWeeklyPlan, PantryStaple, InsertPantryStaple } from "@shared/schema";
import { eq } from "drizzle-orm";

const sqlite = new Database("data.db");

// Auto-create tables if they don't exist (essential for fresh deployments)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    cuisine TEXT NOT NULL,
    meal_type TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    prep_time INTEGER,
    cook_time INTEGER,
    servings INTEGER NOT NULL DEFAULT 3,
    ingredients TEXT NOT NULL,
    instructions TEXT,
    tags TEXT,
    image_url TEXT,
    source_url TEXT,
    is_favorite INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS weekly_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start TEXT NOT NULL,
    meals TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pantry_staples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL
  );
`);

// Add source_url column if missing (migration for existing databases)
try {
  sqlite.exec(`ALTER TABLE recipes ADD COLUMN source_url TEXT`);
} catch {
  // Column already exists, ignore
}

const db = drizzle(sqlite);

export interface IStorage {
  // Recipes
  getRecipes(): Recipe[];
  getRecipe(id: number): Recipe | undefined;
  createRecipe(recipe: InsertRecipe): Recipe;
  updateRecipe(id: number, recipe: Partial<InsertRecipe>): Recipe | undefined;
  deleteRecipe(id: number): void;
  toggleFavorite(id: number): Recipe | undefined;

  // Weekly Plans
  getWeeklyPlans(): WeeklyPlan[];
  getWeeklyPlan(weekStart: string): WeeklyPlan | undefined;
  upsertWeeklyPlan(plan: InsertWeeklyPlan): WeeklyPlan;
  deleteWeeklyPlan(id: number): void;

  // Pantry Staples
  getPantryStaples(): PantryStaple[];
  createPantryStaple(staple: InsertPantryStaple): PantryStaple;
  deletePantryStaple(id: number): void;

  // Seed
  seedDefaultData(): void;
}

export class DatabaseStorage implements IStorage {
  getRecipes(): Recipe[] {
    return db.select().from(recipes).all();
  }

  getRecipe(id: number): Recipe | undefined {
    return db.select().from(recipes).where(eq(recipes.id, id)).get();
  }

  createRecipe(recipe: InsertRecipe): Recipe {
    return db.insert(recipes).values(recipe).returning().get();
  }

  updateRecipe(id: number, recipe: Partial<InsertRecipe>): Recipe | undefined {
    return db.update(recipes).set(recipe).where(eq(recipes.id, id)).returning().get();
  }

  deleteRecipe(id: number): void {
    db.delete(recipes).where(eq(recipes.id, id)).run();
  }

  toggleFavorite(id: number): Recipe | undefined {
    const existing = this.getRecipe(id);
    if (!existing) return undefined;
    return db.update(recipes)
      .set({ isFavorite: existing.isFavorite ? 0 : 1 })
      .where(eq(recipes.id, id))
      .returning()
      .get();
  }

  getWeeklyPlans(): WeeklyPlan[] {
    return db.select().from(weeklyPlans).all();
  }

  getWeeklyPlan(weekStart: string): WeeklyPlan | undefined {
    return db.select().from(weeklyPlans).where(eq(weeklyPlans.weekStart, weekStart)).get();
  }

  upsertWeeklyPlan(plan: InsertWeeklyPlan): WeeklyPlan {
    const existing = this.getWeeklyPlan(plan.weekStart);
    if (existing) {
      return db.update(weeklyPlans)
        .set({ meals: plan.meals })
        .where(eq(weeklyPlans.id, existing.id))
        .returning()
        .get();
    }
    return db.insert(weeklyPlans).values(plan).returning().get();
  }

  deleteWeeklyPlan(id: number): void {
    db.delete(weeklyPlans).where(eq(weeklyPlans.id, id)).run();
  }

  getPantryStaples(): PantryStaple[] {
    return db.select().from(pantryStaples).all();
  }

  createPantryStaple(staple: InsertPantryStaple): PantryStaple {
    return db.insert(pantryStaples).values(staple).returning().get();
  }

  deletePantryStaple(id: number): void {
    db.delete(pantryStaples).where(eq(pantryStaples.id, id)).run();
  }

  seedDefaultData(): void {
    // Check if we already have recipes
    const existingRecipes = this.getRecipes();
    if (existingRecipes.length > 0) return;

    // Seed pantry staples
    const staples = [
      { name: "Salt", category: "spices" },
      { name: "Black pepper", category: "spices" },
      { name: "Garlic powder", category: "spices" },
      { name: "Onion powder", category: "spices" },
      { name: "Cumin", category: "spices" },
      { name: "Chili powder", category: "spices" },
      { name: "Paprika", category: "spices" },
      { name: "Italian seasoning", category: "spices" },
      { name: "Red pepper flakes", category: "spices" },
      { name: "Olive oil", category: "oils" },
      { name: "Vegetable oil", category: "oils" },
      { name: "Soy sauce", category: "condiments" },
      { name: "Hot sauce", category: "condiments" },
      { name: "Rice", category: "grains" },
      { name: "Flour", category: "grains" },
      { name: "Sugar", category: "pantry" },
      { name: "Brown sugar", category: "pantry" },
      { name: "Chicken broth", category: "pantry" },
      { name: "Canned diced tomatoes", category: "pantry" },
      { name: "Tomato paste", category: "pantry" },
    ];
    for (const s of staples) {
      db.insert(pantryStaples).values(s).run();
    }

    // Seed starter recipes
    const starterRecipes: InsertRecipe[] = [
      {
        name: "Crockpot Chicken Taco Bowls",
        description: "Dump-and-go crockpot chicken that shreds into perfect taco bowls. Set it in the morning, bowls ready by lunch.",
        cuisine: "tex-mex",
        mealType: "either",
        difficulty: "easy",
        prepTime: 10,
        cookTime: 480,
        servings: 3,
        ingredients: JSON.stringify([
          { name: "Chicken thighs (boneless)", amount: 2, unit: "lbs", category: "protein" },
          { name: "Salsa", amount: 16, unit: "oz", category: "pantry" },
          { name: "Black beans (canned, drained)", amount: 15, unit: "oz", category: "pantry" },
          { name: "Corn (frozen)", amount: 1, unit: "cup", category: "frozen" },
          { name: "Taco seasoning", amount: 1, unit: "packet", category: "pantry" },
          { name: "Rice", amount: 2, unit: "cups", category: "grains" },
          { name: "Shredded cheese", amount: 1, unit: "cup", category: "dairy" },
          { name: "Sour cream", amount: 0.5, unit: "cup", category: "dairy" },
          { name: "Avocado", amount: 2, unit: "whole", category: "produce" },
          { name: "Lime", amount: 2, unit: "whole", category: "produce" },
          { name: "Cilantro", amount: 1, unit: "bunch", category: "produce" },
        ]),
        instructions: JSON.stringify([
          "Place chicken thighs in the crockpot.",
          "Pour salsa over chicken, add drained black beans, frozen corn, and taco seasoning.",
          "Cook on LOW 6-8 hours or HIGH 3-4 hours.",
          "Shred chicken with two forks, stir everything together.",
          "Cook rice according to package directions.",
          "Serve over rice with cheese, sour cream, avocado, lime, and cilantro."
        ]),
        tags: JSON.stringify(["crockpot", "make-ahead", "freezer-friendly"]),
        imageUrl: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop",
        isFavorite: 1,
      },
      {
        name: "Korean Beef Bowls",
        description: "Sweet and savory ground beef over rice — 20 minutes total. A weeknight staple.",
        cuisine: "asian",
        mealType: "dinner",
        difficulty: "easy",
        prepTime: 5,
        cookTime: 15,
        servings: 3,
        ingredients: JSON.stringify([
          { name: "Ground beef", amount: 1.5, unit: "lbs", category: "protein" },
          { name: "Soy sauce", amount: 0.33, unit: "cup", category: "pantry" },
          { name: "Brown sugar", amount: 3, unit: "tbsp", category: "pantry" },
          { name: "Sesame oil", amount: 2, unit: "tbsp", category: "pantry" },
          { name: "Garlic cloves", amount: 4, unit: "whole", category: "produce" },
          { name: "Fresh ginger", amount: 1, unit: "tbsp", category: "produce" },
          { name: "Rice", amount: 2, unit: "cups", category: "grains" },
          { name: "Green onions", amount: 4, unit: "whole", category: "produce" },
          { name: "Sriracha", amount: 1, unit: "tbsp", category: "condiments" },
          { name: "Broccoli (frozen)", amount: 12, unit: "oz", category: "frozen" },
        ]),
        instructions: JSON.stringify([
          "Cook rice according to package directions.",
          "Brown ground beef in a large skillet, drain fat.",
          "Mix soy sauce, brown sugar, sesame oil, minced garlic, ginger, and sriracha.",
          "Pour sauce over beef, simmer 3-4 minutes.",
          "Steam broccoli in microwave.",
          "Serve beef over rice with broccoli, top with sliced green onions."
        ]),
        tags: JSON.stringify(["quick", "make-ahead"]),
        imageUrl: "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=400&h=300&fit=crop",
        isFavorite: 1,
      },
      {
        name: "Baked Penne Marinara",
        description: "Classic comfort baked pasta with sausage and melted mozzarella. Easy to make a big batch.",
        cuisine: "italian",
        mealType: "dinner",
        difficulty: "easy",
        prepTime: 10,
        cookTime: 35,
        servings: 3,
        ingredients: JSON.stringify([
          { name: "Penne pasta", amount: 1, unit: "lb", category: "pantry" },
          { name: "Italian sausage", amount: 1, unit: "lb", category: "protein" },
          { name: "Marinara sauce", amount: 24, unit: "oz", category: "pantry" },
          { name: "Mozzarella cheese (shredded)", amount: 2, unit: "cups", category: "dairy" },
          { name: "Parmesan cheese", amount: 0.5, unit: "cup", category: "dairy" },
          { name: "Garlic cloves", amount: 3, unit: "whole", category: "produce" },
          { name: "Fresh basil", amount: 1, unit: "bunch", category: "produce" },
        ]),
        instructions: JSON.stringify([
          "Preheat oven to 375°F.",
          "Cook penne until al dente, drain.",
          "Brown Italian sausage with minced garlic, break into crumbles.",
          "Combine pasta, sausage, and marinara in a baking dish.",
          "Top with mozzarella and parmesan.",
          "Bake 20-25 minutes until cheese is bubbly and golden.",
          "Garnish with fresh basil."
        ]),
        tags: JSON.stringify(["make-ahead", "freezer-friendly"]),
        imageUrl: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop",
        isFavorite: 0,
      },
      {
        name: "Crockpot Chicken Tortilla Soup",
        description: "Spicy, hearty soup that practically makes itself. Perfect with tortilla chips and avocado.",
        cuisine: "tex-mex",
        mealType: "either",
        difficulty: "easy",
        prepTime: 10,
        cookTime: 480,
        servings: 3,
        ingredients: JSON.stringify([
          { name: "Chicken breasts (boneless)", amount: 1.5, unit: "lbs", category: "protein" },
          { name: "Canned diced tomatoes", amount: 28, unit: "oz", category: "pantry" },
          { name: "Black beans (canned, drained)", amount: 15, unit: "oz", category: "pantry" },
          { name: "Corn (frozen)", amount: 1, unit: "cup", category: "frozen" },
          { name: "Chicken broth", amount: 32, unit: "oz", category: "pantry" },
          { name: "Chipotle in adobo", amount: 2, unit: "tbsp", category: "pantry" },
          { name: "Cumin", amount: 1, unit: "tsp", category: "pantry" },
          { name: "Lime", amount: 2, unit: "whole", category: "produce" },
          { name: "Avocado", amount: 2, unit: "whole", category: "produce" },
          { name: "Tortilla chips", amount: 1, unit: "bag", category: "pantry" },
          { name: "Shredded cheese", amount: 1, unit: "cup", category: "dairy" },
          { name: "Cilantro", amount: 1, unit: "bunch", category: "produce" },
        ]),
        instructions: JSON.stringify([
          "Place chicken in crockpot.",
          "Add tomatoes, black beans, corn, broth, chipotle, and cumin.",
          "Cook LOW 6-8 hours or HIGH 3-4 hours.",
          "Shred chicken, stir back in.",
          "Serve with crushed tortilla chips, cheese, avocado, lime, and cilantro."
        ]),
        tags: JSON.stringify(["crockpot", "make-ahead", "freezer-friendly"]),
        imageUrl: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop",
        isFavorite: 0,
      },
      {
        name: "Teriyaki Chicken Stir-Fry",
        description: "Quick stir-fry with crispy chicken and veggies in homemade teriyaki. Better than takeout.",
        cuisine: "asian",
        mealType: "dinner",
        difficulty: "easy",
        prepTime: 10,
        cookTime: 15,
        servings: 3,
        ingredients: JSON.stringify([
          { name: "Chicken thighs (boneless)", amount: 1.5, unit: "lbs", category: "protein" },
          { name: "Soy sauce", amount: 0.25, unit: "cup", category: "pantry" },
          { name: "Honey", amount: 3, unit: "tbsp", category: "pantry" },
          { name: "Rice vinegar", amount: 2, unit: "tbsp", category: "pantry" },
          { name: "Cornstarch", amount: 1, unit: "tbsp", category: "pantry" },
          { name: "Garlic cloves", amount: 3, unit: "whole", category: "produce" },
          { name: "Broccoli", amount: 2, unit: "cups", category: "produce" },
          { name: "Bell peppers", amount: 2, unit: "whole", category: "produce" },
          { name: "Rice", amount: 2, unit: "cups", category: "grains" },
          { name: "Sesame seeds", amount: 1, unit: "tbsp", category: "pantry" },
          { name: "Green onions", amount: 3, unit: "whole", category: "produce" },
        ]),
        instructions: JSON.stringify([
          "Cook rice according to package directions.",
          "Cut chicken into bite-sized pieces.",
          "Mix soy sauce, honey, rice vinegar, and cornstarch for sauce.",
          "Cook chicken in a hot skillet/wok until golden, set aside.",
          "Stir-fry broccoli and bell peppers 3-4 minutes.",
          "Return chicken, pour sauce over, cook until thickened.",
          "Serve over rice, top with sesame seeds and green onions."
        ]),
        tags: JSON.stringify(["quick"]),
        imageUrl: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=300&fit=crop",
        isFavorite: 0,
      },
      {
        name: "Sheet Pan Italian Sausage & Peppers",
        description: "One pan, minimal effort. Roasted sausage and veggies served on hoagies or over pasta.",
        cuisine: "italian",
        mealType: "dinner",
        difficulty: "easy",
        prepTime: 10,
        cookTime: 25,
        servings: 3,
        ingredients: JSON.stringify([
          { name: "Italian sausage links", amount: 6, unit: "whole", category: "protein" },
          { name: "Bell peppers", amount: 3, unit: "whole", category: "produce" },
          { name: "Onion (large)", amount: 1, unit: "whole", category: "produce" },
          { name: "Olive oil", amount: 2, unit: "tbsp", category: "pantry" },
          { name: "Italian seasoning", amount: 1, unit: "tbsp", category: "pantry" },
          { name: "Hoagie rolls", amount: 6, unit: "whole", category: "bakery" },
          { name: "Provolone cheese", amount: 6, unit: "slices", category: "dairy" },
        ]),
        instructions: JSON.stringify([
          "Preheat oven to 400°F.",
          "Cut peppers and onion into strips.",
          "Toss veggies with olive oil and Italian seasoning on a sheet pan.",
          "Nestle sausage links among the veggies.",
          "Roast 25 minutes, flipping sausages halfway.",
          "Serve on hoagie rolls with provolone."
        ]),
        tags: JSON.stringify(["quick", "one-pan"]),
        imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop",
        isFavorite: 0,
      },
      {
        name: "Chicken Enchilada Casserole",
        description: "Layered enchilada bake — all the flavor, none of the rolling. Great leftover game.",
        cuisine: "tex-mex",
        mealType: "dinner",
        difficulty: "easy",
        prepTime: 15,
        cookTime: 30,
        servings: 3,
        ingredients: JSON.stringify([
          { name: "Rotisserie chicken (shredded)", amount: 1, unit: "whole", category: "protein" },
          { name: "Enchilada sauce (red)", amount: 28, unit: "oz", category: "pantry" },
          { name: "Corn tortillas", amount: 12, unit: "whole", category: "pantry" },
          { name: "Shredded cheese", amount: 2, unit: "cups", category: "dairy" },
          { name: "Sour cream", amount: 0.5, unit: "cup", category: "dairy" },
          { name: "Black beans (canned, drained)", amount: 15, unit: "oz", category: "pantry" },
          { name: "Green onions", amount: 4, unit: "whole", category: "produce" },
          { name: "Cilantro", amount: 1, unit: "bunch", category: "produce" },
        ]),
        instructions: JSON.stringify([
          "Preheat oven to 375°F.",
          "Spread a thin layer of enchilada sauce on the bottom of a 9x13 dish.",
          "Layer: tortillas, chicken, beans, cheese, sauce. Repeat 2-3 times.",
          "Top with remaining cheese.",
          "Bake 25-30 minutes until bubbly.",
          "Top with sour cream, green onions, and cilantro."
        ]),
        tags: JSON.stringify(["make-ahead", "freezer-friendly"]),
        imageUrl: "https://images.unsplash.com/photo-1534352956036-cd81e27dd615?w=400&h=300&fit=crop",
        isFavorite: 0,
      },
      {
        name: "Crockpot Beef Ramen",
        description: "Rich, beefy broth with ramen noodles. Start it before work, slurp it for dinner.",
        cuisine: "asian",
        mealType: "dinner",
        difficulty: "easy",
        prepTime: 10,
        cookTime: 480,
        servings: 3,
        ingredients: JSON.stringify([
          { name: "Chuck roast", amount: 2, unit: "lbs", category: "protein" },
          { name: "Beef broth", amount: 32, unit: "oz", category: "pantry" },
          { name: "Soy sauce", amount: 0.25, unit: "cup", category: "pantry" },
          { name: "Hoisin sauce", amount: 2, unit: "tbsp", category: "pantry" },
          { name: "Fresh ginger", amount: 1, unit: "tbsp", category: "produce" },
          { name: "Garlic cloves", amount: 4, unit: "whole", category: "produce" },
          { name: "Ramen noodles", amount: 3, unit: "packs", category: "pantry" },
          { name: "Soft-boiled eggs", amount: 6, unit: "whole", category: "dairy" },
          { name: "Green onions", amount: 4, unit: "whole", category: "produce" },
          { name: "Sesame oil", amount: 1, unit: "tbsp", category: "pantry" },
          { name: "Bok choy", amount: 3, unit: "heads", category: "produce" },
        ]),
        instructions: JSON.stringify([
          "Place chuck roast in crockpot.",
          "Add broth, soy sauce, hoisin, ginger, and garlic.",
          "Cook LOW 8 hours until beef is fall-apart tender.",
          "Shred beef, return to broth.",
          "Cook ramen noodles separately according to package.",
          "Halve bok choy and add to broth last 10 minutes.",
          "Divide noodles into bowls, ladle broth and beef over.",
          "Top with soft-boiled eggs, green onions, and a drizzle of sesame oil."
        ]),
        tags: JSON.stringify(["crockpot", "make-ahead"]),
        imageUrl: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=300&fit=crop",
        isFavorite: 0,
      },
      {
        name: "Chicken Alfredo Pasta",
        description: "Creamy garlic alfredo with seared chicken. Comfort food in 25 minutes.",
        cuisine: "italian",
        mealType: "dinner",
        difficulty: "easy",
        prepTime: 5,
        cookTime: 20,
        servings: 3,
        ingredients: JSON.stringify([
          { name: "Chicken breasts (boneless)", amount: 1.5, unit: "lbs", category: "protein" },
          { name: "Fettuccine pasta", amount: 1, unit: "lb", category: "pantry" },
          { name: "Heavy cream", amount: 1, unit: "cup", category: "dairy" },
          { name: "Butter", amount: 3, unit: "tbsp", category: "dairy" },
          { name: "Parmesan cheese", amount: 1, unit: "cup", category: "dairy" },
          { name: "Garlic cloves", amount: 4, unit: "whole", category: "produce" },
          { name: "Italian seasoning", amount: 1, unit: "tsp", category: "pantry" },
          { name: "Fresh parsley", amount: 1, unit: "bunch", category: "produce" },
        ]),
        instructions: JSON.stringify([
          "Cook fettuccine according to package, reserve 1 cup pasta water.",
          "Season chicken with salt, pepper, and Italian seasoning.",
          "Sear chicken in butter until golden and cooked through, slice.",
          "In the same pan, sauté garlic, add heavy cream.",
          "Stir in parmesan until smooth, add pasta water as needed.",
          "Toss pasta in sauce, top with sliced chicken and parsley."
        ]),
        tags: JSON.stringify(["quick"]),
        imageUrl: "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=400&h=300&fit=crop",
        isFavorite: 0,
      },
      {
        name: "Beef & Broccoli",
        description: "Velveted beef with broccoli in savory sauce — takeout flavor, homemade speed.",
        cuisine: "asian",
        mealType: "dinner",
        difficulty: "medium",
        prepTime: 15,
        cookTime: 15,
        servings: 3,
        ingredients: JSON.stringify([
          { name: "Flank steak", amount: 1.5, unit: "lbs", category: "protein" },
          { name: "Broccoli", amount: 3, unit: "cups", category: "produce" },
          { name: "Soy sauce", amount: 0.33, unit: "cup", category: "pantry" },
          { name: "Oyster sauce", amount: 2, unit: "tbsp", category: "pantry" },
          { name: "Brown sugar", amount: 2, unit: "tbsp", category: "pantry" },
          { name: "Cornstarch", amount: 2, unit: "tbsp", category: "pantry" },
          { name: "Garlic cloves", amount: 4, unit: "whole", category: "produce" },
          { name: "Fresh ginger", amount: 1, unit: "tbsp", category: "produce" },
          { name: "Rice", amount: 2, unit: "cups", category: "grains" },
          { name: "Sesame oil", amount: 1, unit: "tbsp", category: "pantry" },
        ]),
        instructions: JSON.stringify([
          "Slice flank steak against the grain into thin strips.",
          "Toss with 1 tbsp cornstarch, 1 tbsp soy sauce — let sit 10 min.",
          "Mix remaining soy sauce, oyster sauce, brown sugar, cornstarch, and sesame oil for sauce.",
          "Cook rice.",
          "Sear beef in a hot wok/skillet in batches, set aside.",
          "Stir-fry broccoli with garlic and ginger 2-3 minutes.",
          "Return beef, pour sauce over, cook until thickened.",
          "Serve over rice."
        ]),
        tags: JSON.stringify(["quick"]),
        imageUrl: "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=400&h=300&fit=crop",
        isFavorite: 0,
      },
      {
        name: "Crockpot Carnitas",
        description: "Pork shoulder slow-cooked until shreddable, then crisped under the broiler. Taco night hero.",
        cuisine: "tex-mex",
        mealType: "either",
        difficulty: "easy",
        prepTime: 10,
        cookTime: 480,
        servings: 3,
        ingredients: JSON.stringify([
          { name: "Pork shoulder", amount: 3, unit: "lbs", category: "protein" },
          { name: "Orange juice", amount: 0.5, unit: "cup", category: "produce" },
          { name: "Lime", amount: 3, unit: "whole", category: "produce" },
          { name: "Garlic cloves", amount: 6, unit: "whole", category: "produce" },
          { name: "Cumin", amount: 1, unit: "tbsp", category: "pantry" },
          { name: "Oregano", amount: 1, unit: "tsp", category: "pantry" },
          { name: "Small flour tortillas", amount: 1, unit: "pack", category: "pantry" },
          { name: "White onion", amount: 1, unit: "whole", category: "produce" },
          { name: "Cilantro", amount: 1, unit: "bunch", category: "produce" },
          { name: "Salsa verde", amount: 16, unit: "oz", category: "pantry" },
        ]),
        instructions: JSON.stringify([
          "Rub pork shoulder with cumin, oregano, salt, and pepper.",
          "Place in crockpot with orange juice, lime juice, and garlic.",
          "Cook LOW 8-10 hours until very tender.",
          "Shred pork, spread on a sheet pan.",
          "Broil 3-5 minutes until edges crisp.",
          "Serve in tortillas with diced onion, cilantro, salsa verde, and lime."
        ]),
        tags: JSON.stringify(["crockpot", "make-ahead", "freezer-friendly"]),
        imageUrl: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=400&h=300&fit=crop",
        isFavorite: 1,
      },
      {
        name: "Chicken Fried Rice",
        description: "Use leftover rice for the best fried rice. Quick lunch or dinner in 15 minutes.",
        cuisine: "asian",
        mealType: "either",
        difficulty: "easy",
        prepTime: 5,
        cookTime: 10,
        servings: 3,
        ingredients: JSON.stringify([
          { name: "Cooked rice (day-old)", amount: 4, unit: "cups", category: "grains" },
          { name: "Chicken thighs (boneless)", amount: 1, unit: "lb", category: "protein" },
          { name: "Eggs", amount: 4, unit: "whole", category: "dairy" },
          { name: "Soy sauce", amount: 3, unit: "tbsp", category: "pantry" },
          { name: "Sesame oil", amount: 1, unit: "tbsp", category: "pantry" },
          { name: "Frozen peas & carrots", amount: 1, unit: "cup", category: "frozen" },
          { name: "Green onions", amount: 4, unit: "whole", category: "produce" },
          { name: "Garlic cloves", amount: 3, unit: "whole", category: "produce" },
        ]),
        instructions: JSON.stringify([
          "Dice chicken, cook in a hot wok until golden. Set aside.",
          "Scramble eggs in the wok, break into pieces. Set aside.",
          "Cook garlic and frozen peas/carrots 2 minutes.",
          "Add day-old rice, press flat and let it crisp slightly.",
          "Add soy sauce and sesame oil, toss everything together.",
          "Return chicken and eggs, stir to combine.",
          "Top with green onions."
        ]),
        tags: JSON.stringify(["quick", "make-ahead"]),
        imageUrl: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&h=300&fit=crop",
        isFavorite: 0,
      },
      {
        name: "Crockpot White Chicken Chili",
        description: "Creamy, slightly spicy white bean chili. Amazing with cornbread or tortilla chips.",
        cuisine: "tex-mex",
        mealType: "either",
        difficulty: "easy",
        prepTime: 10,
        cookTime: 480,
        servings: 3,
        ingredients: JSON.stringify([
          { name: "Chicken breasts (boneless)", amount: 1.5, unit: "lbs", category: "protein" },
          { name: "Great northern beans (canned)", amount: 30, unit: "oz", category: "pantry" },
          { name: "Chicken broth", amount: 16, unit: "oz", category: "pantry" },
          { name: "Diced green chiles", amount: 8, unit: "oz", category: "pantry" },
          { name: "Cumin", amount: 1, unit: "tsp", category: "pantry" },
          { name: "Cream cheese", amount: 8, unit: "oz", category: "dairy" },
          { name: "Shredded cheese", amount: 1, unit: "cup", category: "dairy" },
          { name: "Jalapeño", amount: 1, unit: "whole", category: "produce" },
          { name: "Sour cream", amount: 0.5, unit: "cup", category: "dairy" },
          { name: "Tortilla chips", amount: 1, unit: "bag", category: "pantry" },
        ]),
        instructions: JSON.stringify([
          "Place chicken in crockpot.",
          "Add beans, broth, green chiles, cumin, and diced jalapeño.",
          "Cook LOW 6-8 hours.",
          "Shred chicken, stir back in.",
          "Add cream cheese cubes, stir until melted and creamy.",
          "Serve topped with shredded cheese, sour cream, and tortilla chips."
        ]),
        tags: JSON.stringify(["crockpot", "make-ahead", "freezer-friendly"]),
        imageUrl: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop",
        isFavorite: 0,
      },
      {
        name: "One-Pot Pasta e Fagioli",
        description: "Italian bean and pasta soup — hearty, cheap, and makes incredible leftovers.",
        cuisine: "italian",
        mealType: "either",
        difficulty: "easy",
        prepTime: 10,
        cookTime: 25,
        servings: 3,
        ingredients: JSON.stringify([
          { name: "Ground beef", amount: 1, unit: "lb", category: "protein" },
          { name: "Ditalini pasta", amount: 8, unit: "oz", category: "pantry" },
          { name: "Canned diced tomatoes", amount: 28, unit: "oz", category: "pantry" },
          { name: "Kidney beans (canned, drained)", amount: 15, unit: "oz", category: "pantry" },
          { name: "Cannellini beans (canned, drained)", amount: 15, unit: "oz", category: "pantry" },
          { name: "Beef broth", amount: 32, unit: "oz", category: "pantry" },
          { name: "Carrots", amount: 2, unit: "whole", category: "produce" },
          { name: "Celery stalks", amount: 2, unit: "whole", category: "produce" },
          { name: "Onion", amount: 1, unit: "whole", category: "produce" },
          { name: "Garlic cloves", amount: 3, unit: "whole", category: "produce" },
          { name: "Italian seasoning", amount: 1, unit: "tbsp", category: "pantry" },
          { name: "Parmesan cheese", amount: 0.5, unit: "cup", category: "dairy" },
        ]),
        instructions: JSON.stringify([
          "Brown ground beef with diced onion, carrots, celery, and garlic.",
          "Add tomatoes, both beans, broth, and Italian seasoning.",
          "Bring to a boil, add pasta.",
          "Simmer 10-12 minutes until pasta is tender.",
          "Serve topped with grated parmesan."
        ]),
        tags: JSON.stringify(["one-pot", "make-ahead", "freezer-friendly"]),
        imageUrl: "https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=400&h=300&fit=crop",
        isFavorite: 0,
      },
      {
        name: "Thai Basil Chicken (Pad Krapow)",
        description: "Spicy, savory ground chicken with Thai basil over jasmine rice. 15-minute magic.",
        cuisine: "asian",
        mealType: "dinner",
        difficulty: "easy",
        prepTime: 5,
        cookTime: 10,
        servings: 3,
        ingredients: JSON.stringify([
          { name: "Ground chicken", amount: 1.5, unit: "lbs", category: "protein" },
          { name: "Thai basil leaves", amount: 2, unit: "cups", category: "produce" },
          { name: "Soy sauce", amount: 2, unit: "tbsp", category: "pantry" },
          { name: "Fish sauce", amount: 2, unit: "tbsp", category: "pantry" },
          { name: "Oyster sauce", amount: 1, unit: "tbsp", category: "pantry" },
          { name: "Brown sugar", amount: 1, unit: "tbsp", category: "pantry" },
          { name: "Thai chili peppers", amount: 4, unit: "whole", category: "produce" },
          { name: "Garlic cloves", amount: 5, unit: "whole", category: "produce" },
          { name: "Jasmine rice", amount: 2, unit: "cups", category: "grains" },
          { name: "Eggs", amount: 3, unit: "whole", category: "dairy" },
        ]),
        instructions: JSON.stringify([
          "Cook jasmine rice.",
          "Mince garlic and chilis. Cook in hot oil until fragrant.",
          "Add ground chicken, break apart, cook until no longer pink.",
          "Add soy sauce, fish sauce, oyster sauce, and brown sugar.",
          "Toss in Thai basil, stir until wilted.",
          "Fry eggs sunny-side-up.",
          "Serve chicken over rice, top with fried egg."
        ]),
        tags: JSON.stringify(["quick"]),
        imageUrl: "https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=400&h=300&fit=crop",
        isFavorite: 0,
      },
      {
        name: "Loaded Nachos",
        description: "When you want something indulgent and easy. Layer it up and go. Great for game night.",
        cuisine: "tex-mex",
        mealType: "dinner",
        difficulty: "easy",
        prepTime: 10,
        cookTime: 10,
        servings: 3,
        ingredients: JSON.stringify([
          { name: "Ground beef", amount: 1, unit: "lb", category: "protein" },
          { name: "Tortilla chips", amount: 1, unit: "large bag", category: "pantry" },
          { name: "Shredded cheese", amount: 2, unit: "cups", category: "dairy" },
          { name: "Black beans (canned, drained)", amount: 15, unit: "oz", category: "pantry" },
          { name: "Jalapeño", amount: 2, unit: "whole", category: "produce" },
          { name: "Sour cream", amount: 0.5, unit: "cup", category: "dairy" },
          { name: "Avocado", amount: 2, unit: "whole", category: "produce" },
          { name: "Taco seasoning", amount: 1, unit: "packet", category: "pantry" },
          { name: "Pico de gallo", amount: 1, unit: "cup", category: "produce" },
        ]),
        instructions: JSON.stringify([
          "Preheat oven to 400°F.",
          "Brown ground beef, add taco seasoning.",
          "Layer chips on a sheet pan, top with beef, beans, cheese, and jalapeños.",
          "Bake 8-10 minutes until cheese is melted.",
          "Top with sour cream, avocado, and pico de gallo."
        ]),
        tags: JSON.stringify(["quick"]),
        imageUrl: "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=400&h=300&fit=crop",
        isFavorite: 0,
      },
      {
        name: "Crockpot Chicken Tikka Masala",
        description: "Rich, creamy curry without the effort. Tastes like your favorite Indian spot.",
        cuisine: "asian",
        mealType: "dinner",
        difficulty: "easy",
        prepTime: 10,
        cookTime: 480,
        servings: 3,
        ingredients: JSON.stringify([
          { name: "Chicken thighs (boneless)", amount: 2, unit: "lbs", category: "protein" },
          { name: "Canned crushed tomatoes", amount: 28, unit: "oz", category: "pantry" },
          { name: "Heavy cream", amount: 0.5, unit: "cup", category: "dairy" },
          { name: "Onion (large)", amount: 1, unit: "whole", category: "produce" },
          { name: "Garlic cloves", amount: 4, unit: "whole", category: "produce" },
          { name: "Fresh ginger", amount: 1, unit: "tbsp", category: "produce" },
          { name: "Garam masala", amount: 2, unit: "tbsp", category: "pantry" },
          { name: "Turmeric", amount: 1, unit: "tsp", category: "pantry" },
          { name: "Basmati rice", amount: 2, unit: "cups", category: "grains" },
          { name: "Naan bread", amount: 1, unit: "pack", category: "bakery" },
          { name: "Cilantro", amount: 1, unit: "bunch", category: "produce" },
        ]),
        instructions: JSON.stringify([
          "Place chicken in crockpot.",
          "Add crushed tomatoes, diced onion, garlic, ginger, garam masala, and turmeric.",
          "Cook LOW 6-8 hours.",
          "Shred or cut chicken into pieces.",
          "Stir in heavy cream.",
          "Cook basmati rice.",
          "Serve over rice with naan and cilantro."
        ]),
        tags: JSON.stringify(["crockpot", "make-ahead"]),
        imageUrl: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop",
        isFavorite: 0,
      },
      {
        name: "Quesadilla Bar",
        description: "Prep the fillings, everyone builds their own. The easiest dinner that everyone loves.",
        cuisine: "tex-mex",
        mealType: "either",
        difficulty: "easy",
        prepTime: 10,
        cookTime: 5,
        servings: 3,
        ingredients: JSON.stringify([
          { name: "Large flour tortillas", amount: 1, unit: "pack", category: "pantry" },
          { name: "Rotisserie chicken (shredded)", amount: 1, unit: "whole", category: "protein" },
          { name: "Shredded cheese", amount: 2, unit: "cups", category: "dairy" },
          { name: "Bell peppers", amount: 2, unit: "whole", category: "produce" },
          { name: "Onion", amount: 1, unit: "whole", category: "produce" },
          { name: "Jalapeño", amount: 2, unit: "whole", category: "produce" },
          { name: "Sour cream", amount: 0.5, unit: "cup", category: "dairy" },
          { name: "Salsa", amount: 16, unit: "oz", category: "pantry" },
          { name: "Guacamole", amount: 8, unit: "oz", category: "produce" },
        ]),
        instructions: JSON.stringify([
          "Shred rotisserie chicken.",
          "Slice peppers, onions, and jalapeños.",
          "Set out all fillings in bowls.",
          "Each person builds their quesadilla with their preferred fillings.",
          "Cook on a skillet over medium heat 2-3 minutes per side until golden.",
          "Serve with salsa, sour cream, and guacamole."
        ]),
        tags: JSON.stringify(["quick", "make-ahead"]),
        imageUrl: "https://images.unsplash.com/photo-1618040996337-56904b7850b9?w=400&h=300&fit=crop",
        isFavorite: 0,
      },
    ];

    for (const recipe of starterRecipes) {
      db.insert(recipes).values(recipe).run();
    }
  }
}

export const storage = new DatabaseStorage();
