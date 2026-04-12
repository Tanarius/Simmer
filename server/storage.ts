import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  recipes, weeklyPlans, pantryStaples, users, households,
  userPreferences, userOnboarding, onboardingSwipes,
  userTasteProfile, householdTasteProfile, copilotSessions, activityLog, mealReactions
} from "@shared/schema";
import type {
  Recipe, InsertRecipe, WeeklyPlan, InsertWeeklyPlan,
  PantryStaple, InsertPantryStaple, User, InsertUser,
  UserPreference, UserTasteProfile as DbUserTasteProfile, CopilotSession, ActivityLogEntry,
  MealReaction, Household
} from "@shared/schema";
import { eq, desc, and, inArray } from "drizzle-orm";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("ERROR: DATABASE_URL environment variable is not set!");
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

export interface IStorage {
  init(): Promise<void>;

  // Households
  createHousehold(name: string, inviteCode: string): Promise<Household>;
  getHousehold(id: number): Promise<Household | undefined>;
  getHouseholdByInviteCode(code: string): Promise<Household | undefined>;
  getHouseholdMembers(householdId: number): Promise<User[]>;
  setUserHousehold(userId: number, householdId: number): Promise<void>;
  updateHouseholdName(householdId: number, name: string): Promise<void>;
  updateHouseholdInviteCode(householdId: number, inviteCode: string): Promise<void>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;

  // Users & AI Limits
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUserAiUsage(userId: number): Promise<{ aiCallsToday: number; aiCallsResetDate: string | null; copilotCallsToday: number; copilotResetDate: string | null; subscriptionTier: string }>;
  incrementAiCalls(userId: number): Promise<{ newCount: number }>;
  incrementCopilotCalls(userId: number): Promise<{ newCount: number }>;
  resetAiCallsIfNewDay(userId: number): Promise<void>;
  resetCopilotCallsIfNewDay(userId: number): Promise<void>;
  updateUserSubscriptionTier(userId: number, tier: string): Promise<void>;

  // Preferences & Onboarding
  getUserPreferences(userId: number): Promise<UserPreference | null>;
  upsertUserPreferences(userId: number, prefs: Partial<UserPreference>): Promise<void>;
  getOnboardingState(userId: number): Promise<any | null>;
  createOnboardingState(userId: number): Promise<any>;
  updateOnboardingStep(userId: number, step: number): Promise<void>;
  setOnboardingMode(userId: number, cookingMode: 'cook' | 'eater'): Promise<void>;
  completeOnboarding(userId: number): Promise<void>;
  saveOnboardingSwipe(userId: number, swipe: any): Promise<void>;
  getOnboardingSwipes(userId: number): Promise<any[]>;
  getOnboardingSwipeCount(userId: number): Promise<number>;

  // Taste Profiles
  getUserTasteProfile(userId: number): Promise<DbUserTasteProfile | null>;
  upsertUserTasteProfile(userId: number, profile: Partial<DbUserTasteProfile>): Promise<void>;
  getHouseholdTasteProfile(householdId: number): Promise<any | null>;
  upsertHouseholdTasteProfile(householdId: number, profile: Partial<any>): Promise<void>;
  getAllHouseholdMemberProfiles(householdId: number): Promise<DbUserTasteProfile[]>;
  incrementCuisineSignal(userId: number, cuisineType: string): Promise<void>;
  getRecentMealNames(limit?: number): Promise<string[]>;

  // Copilot Logic
  getCopilotHistory(userId: number, sessionId: string, limit?: number): Promise<any[]>;
  saveCopilotMessage(userId: number, sessionId: string, message: any): Promise<number>;
  updateProposedActionStatus(userId: number, sessionId: string, messageId: number, status: 'applied' | 'dismissed'): Promise<void>;

  // Recipes & Plans
  getRecipes(householdId: number): Promise<Recipe[]>;
  getRecipe(id: number, householdId?: number): Promise<Recipe | undefined>;
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  updateRecipe(id: number, householdId: number, recipe: Partial<InsertRecipe>): Promise<Recipe | undefined>;
  deleteRecipe(id: number, householdId: number): Promise<void>;
  toggleFavorite(id: number, householdId: number): Promise<Recipe | undefined>;

  getWeeklyPlans(householdId: number): Promise<WeeklyPlan[]>;
  getWeeklyPlan(weekStart: string, householdId: number): Promise<WeeklyPlan | undefined>;
  upsertWeeklyPlan(plan: InsertWeeklyPlan): Promise<WeeklyPlan>;
  deleteWeeklyPlan(id: number, householdId: number): Promise<void>;

  getPantryStaples(householdId: number): Promise<PantryStaple[]>;
  createPantryStaple(staple: InsertPantryStaple): Promise<PantryStaple>;
  deletePantryStaple(id: number, householdId: number): Promise<void>;

  seedDefaultData(): Promise<void>;

  // Activity Feed
  logActivity(userId: number, action: string, recipeId?: number | null, recipeName?: string | null): Promise<void>;
  getRecentActivity(householdId: number, limit?: number): Promise<(ActivityLogEntry & { username: string })[]>;

  // Meal Reactions
  upsertReaction(weekStart: string, slotKey: string, userId: number, emoji: string): Promise<void>;
  deleteReaction(weekStart: string, slotKey: string, userId: number): Promise<void>;
  getReactionsForWeek(weekStart: string): Promise<MealReaction[]>;
}

export class DatabaseStorage implements IStorage {
  async init(): Promise<void> {
    // Each statement must be a separate pool.query() — node-postgres multi-statement
    // strings are unreliable (only last result returned, errors may silently skip).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS households (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        invite_code TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`INSERT INTO households (id, name, invite_code) VALUES (1, 'Home', 'HOME0001') ON CONFLICT DO NOTHING`);
    await pool.query(`SELECT setval('households_id_seq', GREATEST((SELECT MAX(id) FROM households), 1))`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS household_id INTEGER REFERENCES households(id)`);
    await pool.query(`UPDATE users SET household_id = 1 WHERE household_id IS NULL`);
    await pool.query(`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS household_id INTEGER REFERENCES households(id)`);
    await pool.query(`UPDATE recipes SET household_id = 1 WHERE household_id IS NULL`);
    await pool.query(`ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS household_id INTEGER REFERENCES households(id)`);
    await pool.query(`UPDATE weekly_plans SET household_id = 1 WHERE household_id IS NULL`);
    await pool.query(`ALTER TABLE pantry_staples ADD COLUMN IF NOT EXISTS household_id INTEGER REFERENCES households(id)`);
    await pool.query(`UPDATE pantry_staples SET household_id = 1 WHERE household_id IS NULL`);
  }

  // Households
  async createHousehold(name: string, inviteCode: string): Promise<Household> {
    const rows = await db.insert(households).values({ name, inviteCode }).returning();
    return rows[0];
  }

  async getHousehold(id: number): Promise<Household | undefined> {
    const rows = await db.select().from(households).where(eq(households.id, id));
    return rows[0];
  }

  async getHouseholdByInviteCode(code: string): Promise<Household | undefined> {
    const rows = await db.select().from(households).where(eq(households.inviteCode, code));
    return rows[0];
  }

  async getHouseholdMembers(householdId: number): Promise<User[]> {
    return await db.select().from(users).where(eq(users.householdId, householdId));
  }

  async setUserHousehold(userId: number, householdId: number): Promise<void> {
    await db.update(users).set({ householdId }).where(eq(users.id, userId));
  }

  async updateHouseholdName(householdId: number, name: string): Promise<void> {
    await db.update(households).set({ name }).where(eq(households.id, householdId));
  }

  async updateHouseholdInviteCode(householdId: number, inviteCode: string): Promise<void> {
    await db.update(households).set({ inviteCode }).where(eq(households.id, householdId));
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
  }

  // Users & AI Limits
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

  async getUserAiUsage(userId: number) {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    return {
      aiCallsToday: user.aiCallsToday,
      aiCallsResetDate: user.aiCallsResetDate,
      copilotCallsToday: user.copilotCallsToday,
      copilotResetDate: user.copilotResetDate,
      subscriptionTier: user.subscriptionTier,
    };
  }

  async incrementAiCalls(userId: number): Promise<{ newCount: number }> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    const today = new Date().toISOString().split('T')[0];
    const rows = await db.update(users)
      .set({ 
        aiCallsToday: user.aiCallsToday + 1,
        aiCallsResetDate: user.aiCallsResetDate || today,
      })
      .where(eq(users.id, userId))
      .returning();
    return { newCount: rows[0].aiCallsToday };
  }

  async incrementCopilotCalls(userId: number): Promise<{ newCount: number }> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    const today = new Date().toISOString().split('T')[0];
    const rows = await db.update(users)
      .set({ 
        copilotCallsToday: user.copilotCallsToday + 1,
        copilotResetDate: user.copilotResetDate || today,
      })
      .where(eq(users.id, userId))
      .returning();
    return { newCount: rows[0].copilotCallsToday };
  }

  async resetAiCallsIfNewDay(userId: number): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;
    const todayStr = new Date().toISOString().split('T')[0];
    if (user.aiCallsResetDate !== todayStr) {
      await db.update(users).set({ aiCallsToday: 0, aiCallsResetDate: todayStr }).where(eq(users.id, userId));
    }
  }

  async resetCopilotCallsIfNewDay(userId: number): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;
    const todayStr = new Date().toISOString().split('T')[0];
    if (user.copilotResetDate !== todayStr) {
      await db.update(users).set({ copilotCallsToday: 0, copilotResetDate: todayStr }).where(eq(users.id, userId));
    }
  }

  async updateUserSubscriptionTier(userId: number, tier: string): Promise<void> {
    await db.update(users).set({ subscriptionTier: tier }).where(eq(users.id, userId));
  }

  // Preferences & Onboarding
  async getUserPreferences(userId: number) {
    const rows = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    return rows[0] || null;
  }

  async upsertUserPreferences(userId: number, prefs: Partial<UserPreference>): Promise<void> {
    const existing = await this.getUserPreferences(userId);
    if (existing) {
      await db.update(userPreferences).set({ ...prefs, updatedAt: new Date() }).where(eq(userPreferences.userId, userId));
    } else {
      await db.insert(userPreferences).values({ userId, ...prefs } as any);
    }
  }

  async getOnboardingState(userId: number) {
    const rows = await db.select().from(userOnboarding).where(eq(userOnboarding.userId, userId));
    return rows[0] || null;
  }

  async createOnboardingState(userId: number) {
    const rows = await db.insert(userOnboarding).values({ userId }).returning();
    return rows[0];
  }

  async updateOnboardingStep(userId: number, step: number): Promise<void> {
    await db.update(userOnboarding).set({ currentStep: step }).where(eq(userOnboarding.userId, userId));
  }

  async setOnboardingMode(userId: number, cookingMode: 'cook' | 'eater'): Promise<void> {
    await db.update(userOnboarding).set({ cookingMode, currentStep: 2 }).where(eq(userOnboarding.userId, userId));
  }

  async completeOnboarding(userId: number): Promise<void> {
    const existing = await this.getOnboardingState(userId);
    if (!existing) {
      await db.insert(userOnboarding).values({ userId, completed: true, completedAt: new Date() });
    } else {
      await db.update(userOnboarding).set({ completed: true, completedAt: new Date() }).where(eq(userOnboarding.userId, userId));
    }
  }

  async saveOnboardingSwipe(userId: number, swipe: any): Promise<void> {
    await db.insert(onboardingSwipes).values({ userId, ...swipe });
  }

  async getOnboardingSwipes(userId: number) {
    return await db.select().from(onboardingSwipes).where(eq(onboardingSwipes.userId, userId)).orderBy(onboardingSwipes.createdAt);
  }

  async getOnboardingSwipeCount(userId: number): Promise<number> {
    const rows = await this.getOnboardingSwipes(userId);
    return rows.length;
  }

  // Taste Profiles
  async getUserTasteProfile(userId: number) {
    const rows = await db.select().from(userTasteProfile).where(eq(userTasteProfile.userId, userId));
    return rows[0] || null;
  }

  async upsertUserTasteProfile(userId: number, profile: Partial<DbUserTasteProfile>): Promise<void> {
    const existing = await this.getUserTasteProfile(userId);
    if (existing) {
      await db.update(userTasteProfile).set({ ...profile, lastUpdated: new Date() }).where(eq(userTasteProfile.userId, userId));
    } else {
      await db.insert(userTasteProfile).values({ userId, ...profile } as any);
    }
  }

  async getHouseholdTasteProfile(householdId: number) {
    const rows = await db.select().from(householdTasteProfile).where(eq(householdTasteProfile.householdId, householdId));
    return rows[0] || null;
  }

  async upsertHouseholdTasteProfile(householdId: number, profile: Partial<any>): Promise<void> {
    const existing = await this.getHouseholdTasteProfile(householdId);
    if (existing) {
      await db.update(householdTasteProfile).set({ ...profile, updatedAt: new Date() }).where(eq(householdTasteProfile.householdId, householdId));
    } else {
      await db.insert(householdTasteProfile).values({ householdId, ...profile } as any);
    }
  }

  async getAllHouseholdMemberProfiles(householdId: number) {
    // For now householdId is userId mapping
    return await db.select().from(userTasteProfile);
  }

  async incrementCuisineSignal(userId: number, cuisineType: string): Promise<void> {
    let profile = await this.getUserTasteProfile(userId);
    if (!profile) {
      await this.upsertUserTasteProfile(userId, { cookingMode: 'eater', cuisineSignals: {}, likedCuisines: [] });
      profile = await this.getUserTasteProfile(userId);
      if (!profile) return;
    }
    const signals = (profile.cuisineSignals as Record<string, number>) || {};
    signals[cuisineType] = (signals[cuisineType] || 0) + 1;

    let liked = [...(profile.likedCuisines || [])];
    if (signals[cuisineType] >= 2 && !liked.includes(cuisineType)) {
      liked.push(cuisineType);
    }

    await db.update(userTasteProfile).set({ cuisineSignals: signals, likedCuisines: liked }).where(eq(userTasteProfile.userId, userId));
  }

  async getRecentMealNames(limit: number = 14): Promise<string[]> {
    // Get the most recent weekly plans, extract all meal values (recipe IDs or name strings)
    const plans = await db.select().from(weeklyPlans).orderBy(desc(weeklyPlans.id)).limit(4);
    const names: string[] = [];
    for (const plan of plans) {
      try {
        const meals = JSON.parse(plan.meals) as Record<string, number | string>;
        for (const val of Object.values(meals)) {
          if (!val) continue;
          if (typeof val === 'string') {
            if (!names.includes(val)) names.push(val);
          } else if (typeof val === 'number') {
            const recipe = await this.getRecipe(val);
            if (recipe && !names.includes(recipe.name)) names.push(recipe.name);
          }
        }
      } catch { /* skip malformed */ }
    }
    return names.slice(0, limit);
  }

  // Copilot History
  async getCopilotHistory(userId: number, sessionId: string, limit: number = 20) {
    return await db.select().from(copilotSessions)
                   .where(and(eq(copilotSessions.userId, userId), eq(copilotSessions.sessionId, sessionId)))
                   .orderBy(desc(copilotSessions.timestamp))
                   .limit(limit);
  }

  async saveCopilotMessage(userId: number, sessionId: string, message: any): Promise<number> {
    const rows = await db.insert(copilotSessions).values({
      userId,
      sessionId,
      role: message.role,
      content: message.content,
      proposedAction: message.proposedAction || null
    }).returning({ id: copilotSessions.id });
    return rows[0].id;
  }

  async updateProposedActionStatus(userId: number, sessionId: string, messageId: number, status: 'applied' | 'dismissed'): Promise<void> {
    const rows = await db.select().from(copilotSessions).where(eq(copilotSessions.id, messageId));
    const msg = rows[0];
    if (msg && msg.proposedAction) {
      const action = msg.proposedAction as any;
      action.status = status;
      await db.update(copilotSessions).set({ proposedAction: action }).where(eq(copilotSessions.id, messageId));
    }
  }

  // Recipes & Plans
  async getRecipes(householdId: number): Promise<Recipe[]> {
    return await db.select().from(recipes).where(eq(recipes.householdId, householdId));
  }

  async getRecipe(id: number, householdId?: number): Promise<Recipe | undefined> {
    const condition = householdId !== undefined
      ? and(eq(recipes.id, id), eq(recipes.householdId, householdId))
      : eq(recipes.id, id);
    const rows = await db.select().from(recipes).where(condition);
    return rows[0];
  }

  async createRecipe(recipe: InsertRecipe): Promise<Recipe> {
    const rows = await db.insert(recipes).values({ ...recipe, isProcessed: recipe.isProcessed ?? false }).returning();
    return rows[0];
  }

  async updateRecipe(id: number, householdId: number, recipe: Partial<InsertRecipe>): Promise<Recipe | undefined> {
    const rows = await db.update(recipes).set(recipe)
      .where(and(eq(recipes.id, id), eq(recipes.householdId, householdId)))
      .returning();
    return rows[0];
  }

  async deleteRecipe(id: number, householdId: number): Promise<void> {
    await db.delete(recipes).where(and(eq(recipes.id, id), eq(recipes.householdId, householdId)));
  }

  async toggleFavorite(id: number, householdId: number): Promise<Recipe | undefined> {
    const existing = await this.getRecipe(id, householdId);
    if (!existing) return undefined;
    const rows = await db.update(recipes).set({ isFavorite: existing.isFavorite ? 0 : 1 })
      .where(and(eq(recipes.id, id), eq(recipes.householdId, householdId)))
      .returning();
    return rows[0];
  }

  async getWeeklyPlans(householdId: number): Promise<WeeklyPlan[]> {
    return await db.select().from(weeklyPlans).where(eq(weeklyPlans.householdId, householdId));
  }

  async getWeeklyPlan(weekStart: string, householdId: number): Promise<WeeklyPlan | undefined> {
    const rows = await db.select().from(weeklyPlans)
      .where(and(eq(weeklyPlans.weekStart, weekStart), eq(weeklyPlans.householdId, householdId)));
    return rows[0];
  }

  async upsertWeeklyPlan(plan: InsertWeeklyPlan): Promise<WeeklyPlan> {
    const existing = await this.getWeeklyPlan(plan.weekStart, plan.householdId);
    if (existing) {
      const updateSet: Record<string, any> = { meals: plan.meals };
      if ((plan as any).mealMeta !== undefined) updateSet.mealMeta = (plan as any).mealMeta;
      const rows = await db.update(weeklyPlans).set(updateSet).where(eq(weeklyPlans.id, existing.id)).returning();
      return rows[0];
    }
    const rows = await db.insert(weeklyPlans).values(plan).returning();
    return rows[0];
  }

  async deleteWeeklyPlan(id: number, householdId: number): Promise<void> {
    await db.delete(weeklyPlans).where(and(eq(weeklyPlans.id, id), eq(weeklyPlans.householdId, householdId)));
  }

  async getPantryStaples(householdId: number): Promise<PantryStaple[]> {
    return await db.select().from(pantryStaples).where(eq(pantryStaples.householdId, householdId));
  }

  async createPantryStaple(staple: InsertPantryStaple): Promise<PantryStaple> {
    const rows = await db.insert(pantryStaples).values(staple).returning();
    return rows[0];
  }

  async deletePantryStaple(id: number, householdId: number): Promise<void> {
    await db.delete(pantryStaples).where(and(eq(pantryStaples.id, id), eq(pantryStaples.householdId, householdId)));
  }

  async seedDefaultData(): Promise<void> {
    const existingRecipes = await this.getRecipes(1);
    if (existingRecipes.length > 0) return;

    const staples = [
      { householdId: 1, name: "Salt", category: "spices" },
      { householdId: 1, name: "Black pepper", category: "spices" },
      { householdId: 1, name: "Garlic powder", category: "spices" },
      { householdId: 1, name: "Olive oil", category: "oils" },
      { householdId: 1, name: "Soy sauce", category: "condiments" },
      { householdId: 1, name: "Rice", category: "grains" }
    ];
    for (const s of staples) {
      await db.insert(pantryStaples).values(s);
    }
  }

  async logActivity(userId: number, action: string, recipeId?: number | null, recipeName?: string | null): Promise<void> {
    await db.insert(activityLog).values({ userId, action, recipeId: recipeId ?? null, recipeName: recipeName ?? null });
  }

  async getRecentActivity(householdId: number, limit = 40): Promise<(ActivityLogEntry & { username: string })[]> {
    // Get user IDs for this household, then filter activity log
    const members = await this.getHouseholdMembers(householdId);
    const memberIds = members.map(m => m.id);
    if (memberIds.length === 0) return [];
    const rows = await db.select().from(activityLog)
      .where(memberIds.length === 1
        ? eq(activityLog.userId, memberIds[0])
        : inArray(activityLog.userId, memberIds))
      .orderBy(desc(activityLog.createdAt))
      .limit(limit);
    const userMap = new Map<number, string>(members.map(m => [m.id, m.username]));
    return rows.map(r => ({ ...r, username: userMap.get(r.userId) ?? "Someone" }));
  }

  async upsertReaction(weekStart: string, slotKey: string, userId: number, emoji: string): Promise<void> {
    await db.insert(mealReactions)
      .values({ weekStart, slotKey, userId, emoji })
      .onConflictDoUpdate({
        target: [mealReactions.weekStart, mealReactions.slotKey, mealReactions.userId],
        set: { emoji },
      });
  }

  async deleteReaction(weekStart: string, slotKey: string, userId: number): Promise<void> {
    await db.delete(mealReactions).where(
      and(
        eq(mealReactions.weekStart, weekStart),
        eq(mealReactions.slotKey, slotKey),
        eq(mealReactions.userId, userId),
      )
    );
  }

  async getReactionsForWeek(weekStart: string): Promise<MealReaction[]> {
    return await db.select().from(mealReactions).where(eq(mealReactions.weekStart, weekStart));
  }
}

export const storage = new DatabaseStorage();
