import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { recipes, weeklyPlans, pantryStaples, users } from "@shared/schema";
import type { Recipe, InsertRecipe, WeeklyPlan, InsertWeeklyPlan, PantryStaple, InsertPantryStaple, User, InsertUser } from "@shared/schema";
import { eq } from "drizzle-orm";

// Debug: Log database connection info (sanitized)
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("ERROR: DATABASE_URL environment variable is not set!");
  console.error("Available env vars:", Object.keys(process.env).filter(k => k.includes('DATA')));
} else {
  console.log("Database URL found:", dbUrl.substring(0, 30) + "...");
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

export interface IStorage {
  // Init
  init(): Promise<void>;

  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUserAiUsage(userId: number): Promise<{ aiCallsToday: number; aiCallsResetDate: string | null; subscriptionTier: string }>;
  incrementAiCalls(userId: number): Promise<void>;
  resetAiCallsIfNewDay(userId: number): Promise<void>;

  // Recipes
  getRecipes(): Promise<Recipe[]>;
  getRecipe(id: number): Promise<Recipe | undefined>;
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  updateRecipe(id: number, recipe: Partial<InsertRecipe>): Promise<Recipe | undefined>;
  deleteRecipe(id: number): Promise<void>;
  toggleFavorite(id: number): Promise<Recipe | undefined>;

  // Weekly Plans
  getWeeklyPlans(): Promise<WeeklyPlan[]>;
  getWeeklyPlan(weekStart: string): Promise<WeeklyPlan | undefined>;
  upsertWeeklyPlan(plan: InsertWeeklyPlan): Promise<WeeklyPlan>;
  deleteWeeklyPlan(id: number): Promise<void>;

  // Pantry Staples
  getPantryStaples(): Promise<PantryStaple[]>;
  createPantryStaple(staple: InsertPantryStaple): Promise<PantryStaple>;
  deletePantryStaple(id: number): Promise<void>;

  // Seed
  seedDefaultData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async init(): Promise<void> {
    // Auto-create tables if they don't exist (essential for fresh deployments)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        subscription_tier TEXT NOT NULL DEFAULT 'free',
        ai_calls_today INTEGER NOT NULL DEFAULT 0,
        ai_calls_reset_date DATE
      );
      CREATE TABLE IF NOT EXISTS recipes (
        id SERIAL PRIMARY KEY,
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
        id SERIAL PRIMARY KEY,
        week_start TEXT NOT NULL,
        meals TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pantry_staples (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL
      );
    `);
  }

  async getUser(id: number): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.id, id));
    return rows[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.username, username));
    return rows[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const rows = await db.insert(users).values(user).returning();
    return rows[0];
  }

  async getUserAiUsage(userId: number): Promise<{ aiCallsToday: number; aiCallsResetDate: string | null; subscriptionTier: string }> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    return {
      aiCallsToday: user.aiCallsToday,
      aiCallsResetDate: user.aiCallsResetDate,
      subscriptionTier: user.subscriptionTier,
    };
  }

  async incrementAiCalls(userId: number): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    
    await db.update(users)
      .set({ 
        aiCallsToday: user.aiCallsToday + 1,
        aiCallsResetDate: user.aiCallsResetDate || today,
      })
      .where(eq(users.id, userId));
  }

  async resetAiCallsIfNewDay(userId: number): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;
    
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (user.aiCallsResetDate !== todayStr) {
      await db.update(users)
        .set({ 
          aiCallsToday: 0,
          aiCallsResetDate: todayStr,
        })
        .where(eq(users.id, userId));
    }
  }

  async getRecipes(): Promise<Recipe[]> {
    return await db.select().from(recipes);
  }

  async getRecipe(id: number): Promise<Recipe | undefined> {
    const rows = await db.select().from(recipes).where(eq(recipes.id, id));
    return rows[0];
  }

  async createRecipe(recipe: InsertRecipe): Promise<Recipe> {
    const rows = await db.insert(recipes).values(recipe).returning();
    return rows[0];
  }

  async updateRecipe(id: number, recipe: Partial<InsertRecipe>): Promise<Recipe | undefined> {
    const rows = await db.update(recipes).set(recipe).where(eq(recipes.id, id)).returning();
    return rows[0];
  }

  async deleteRecipe(id: number): Promise<void> {
    await db.delete(recipes).where(eq(recipes.id, id));
  }

  async toggleFavorite(id: number): Promise<Recipe | undefined> {
    const existing = await this.getRecipe(id);
    if (!existing) return undefined;
    const rows = await db.update(recipes)
      .set({ isFavorite: existing.isFavorite ? 0 : 1 })
      .where(eq(recipes.id, id))
      .returning();
    return rows[0];
  }

  async getWeeklyPlans(): Promise<WeeklyPlan[]> {
    return await db.select().from(weeklyPlans);
  }

  async getWeeklyPlan(weekStart: string): Promise<WeeklyPlan | undefined> {
    const rows = await db.select().from(weeklyPlans).where(eq(weeklyPlans.weekStart, weekStart));
    return rows[0];
  }

  async upsertWeeklyPlan(plan: InsertWeeklyPlan): Promise<WeeklyPlan> {
    const existing = await this.getWeeklyPlan(plan.weekStart);
    if (existing) {
      const rows = await db.update(weeklyPlans)
        .set({ meals: plan.meals })
        .where(eq(weeklyPlans.id, existing.id))
        .returning();
      return rows[0];
    }
    const rows = await db.insert(weeklyPlans).values(plan).returning();
    return rows[0];
  }

  async deleteWeeklyPlan(id: number): Promise<void> {
    await db.delete(weeklyPlans).where(eq(weeklyPlans.id, id));
  }

  async getPantryStaples(): Promise<PantryStaple[]> {
    return await db.select().from(pantryStaples);
  }

  async createPantryStaple(staple: InsertPantryStaple): Promise<PantryStaple> {
    const rows = await db.insert(pantryStaples).values(staple).returning();
    return rows[0];
  }

  async deletePantryStaple(id: number): Promise<void> {
    await db.delete(pantryStaples).where(eq(pantryStaples.id, id));
  }

  async seedDefaultData(): Promise<void> {
    // Check if we already have recipes
    const existingRecipes = await this.getRecipes();
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
      await db.insert(pantryStaples).values(s);
    }

    // No starter recipes - users will add their own recipes
  }
}

export const storage = new DatabaseStorage();
