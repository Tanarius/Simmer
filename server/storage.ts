import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { recipes, weeklyPlans, pantryStaples, users, userTasteProfiles } from "@shared/schema";
import type { Recipe, InsertRecipe, WeeklyPlan, InsertWeeklyPlan, PantryStaple, InsertPantryStaple, User, InsertUser, UserTasteProfile } from "@shared/schema";
import { eq, and } from "drizzle-orm";

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
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
  getUserAiUsage(userId: number): Promise<{ aiCallsToday: number; aiCallsResetDate: string | null; subscriptionTier: string }>;
  incrementAiCalls(userId: number): Promise<void>;
  resetAiCallsIfNewDay(userId: number): Promise<void>;

  // Recipes
  getRecipes(userId: number): Promise<Recipe[]>;
  getRecipe(id: number): Promise<Recipe | undefined>;
  createRecipe(recipe: InsertRecipe & { userId: number }): Promise<Recipe>;
  updateRecipe(id: number, recipe: Partial<InsertRecipe>): Promise<Recipe | undefined>;
  deleteRecipe(id: number): Promise<void>;
  toggleFavorite(id: number): Promise<Recipe | undefined>;

  // Weekly Plans
  getWeeklyPlans(userId: number): Promise<WeeklyPlan[]>;
  getWeeklyPlan(weekStart: string, userId: number): Promise<WeeklyPlan | undefined>;
  upsertWeeklyPlan(plan: InsertWeeklyPlan & { userId: number }): Promise<WeeklyPlan>;
  deleteWeeklyPlan(id: number): Promise<void>;

  // Pantry Staples
  getPantryStaples(userId: number): Promise<PantryStaple[]>;
  createPantryStaple(staple: InsertPantryStaple & { userId: number }): Promise<PantryStaple>;
  deletePantryStaple(id: number): Promise<void>;

  // Taste Profile
  getUserTasteProfile(userId: number): Promise<UserTasteProfile | undefined>;
  upsertUserTasteProfile(userId: number, data: Partial<Omit<UserTasteProfile, 'id' | 'userId'>>): Promise<UserTasteProfile>;

  // Seed
  seedDefaultData(): Promise<void>;
  seedUserDefaults(userId: number): Promise<void>;
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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_taste_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
        household_size INTEGER NOT NULL DEFAULT 1,
        disliked_ingredients TEXT,
        liked_cuisines TEXT,
        dietary_restrictions TEXT,
        complexity_preference TEXT DEFAULT 'medium',
        breakfast_enabled INTEGER NOT NULL DEFAULT 0
      );
    `);
    // Non-destructive migrations: add userId columns if they don't exist yet
    await pool.query(`
      ALTER TABLE recipes ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
      ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
      ALTER TABLE pantry_staples ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
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

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
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

  async getRecipes(userId: number): Promise<Recipe[]> {
    return await db.select().from(recipes).where(eq(recipes.userId, userId));
  }

  async getRecipe(id: number): Promise<Recipe | undefined> {
    const rows = await db.select().from(recipes).where(eq(recipes.id, id));
    return rows[0];
  }

  async createRecipe(recipe: InsertRecipe & { userId: number }): Promise<Recipe> {
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

  async getWeeklyPlans(userId: number): Promise<WeeklyPlan[]> {
    return await db.select().from(weeklyPlans).where(eq(weeklyPlans.userId, userId));
  }

  async getWeeklyPlan(weekStart: string, userId: number): Promise<WeeklyPlan | undefined> {
    const rows = await db.select().from(weeklyPlans)
      .where(and(eq(weeklyPlans.weekStart, weekStart), eq(weeklyPlans.userId, userId)));
    return rows[0];
  }

  async upsertWeeklyPlan(plan: InsertWeeklyPlan & { userId: number }): Promise<WeeklyPlan> {
    const existing = await this.getWeeklyPlan(plan.weekStart, plan.userId);
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

  async getPantryStaples(userId: number): Promise<PantryStaple[]> {
    return await db.select().from(pantryStaples).where(eq(pantryStaples.userId, userId));
  }

  async createPantryStaple(staple: InsertPantryStaple & { userId: number }): Promise<PantryStaple> {
    const rows = await db.insert(pantryStaples).values(staple).returning();
    return rows[0];
  }

  async deletePantryStaple(id: number): Promise<void> {
    await db.delete(pantryStaples).where(eq(pantryStaples.id, id));
  }

  async getUserTasteProfile(userId: number): Promise<UserTasteProfile | undefined> {
    const rows = await db.select().from(userTasteProfiles).where(eq(userTasteProfiles.userId, userId));
    return rows[0];
  }

  async upsertUserTasteProfile(userId: number, data: Partial<Omit<UserTasteProfile, 'id' | 'userId'>>): Promise<UserTasteProfile> {
    const existing = await this.getUserTasteProfile(userId);
    if (existing) {
      const rows = await db.update(userTasteProfiles)
        .set(data)
        .where(eq(userTasteProfiles.userId, userId))
        .returning();
      return rows[0];
    }
    const rows = await db.insert(userTasteProfiles).values({ userId, ...data }).returning();
    return rows[0];
  }

  async seedDefaultData(): Promise<void> {
    // No-op: pantry seeding is now done per-user on first login via seedUserDefaults()
  }

  async seedUserDefaults(userId: number): Promise<void> {
    // Check if user already has staples
    const existing = await this.getPantryStaples(userId);
    if (existing.length > 0) return;

    // Seed pantry staples for this user
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
      await db.insert(pantryStaples).values({ ...s, userId });
    }
  }
}

export const storage = new DatabaseStorage();
