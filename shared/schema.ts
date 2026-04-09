import { pgTable, text, integer, serial, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  subscriptionTier: text("subscription_tier").notNull().default('free'),
  aiCallsToday: integer("ai_calls_today").notNull().default(0),
  aiCallsResetDate: date("ai_calls_reset_date"), 
});

export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  cuisine: text("cuisine").notNull(), // tex-mex, italian, asian, american, other
  mealType: text("meal_type").notNull(), // lunch, dinner, breakfast, either
  difficulty: text("difficulty").notNull(), // easy, medium
  prepTime: integer("prep_time"), // minutes
  cookTime: integer("cook_time"), // minutes
  servings: integer("servings").notNull().default(3),
  ingredients: text("ingredients").notNull(), // JSON array
  instructions: text("instructions"), // JSON array of steps
  tags: text("tags"), // JSON array: crockpot, quick, make-ahead, freezer-friendly, etc.
  imageUrl: text("image_url"),
  sourceUrl: text("source_url"),
  isFavorite: integer("is_favorite").default(0),
});

export const weeklyPlans = pgTable("weekly_plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  weekStart: text("week_start").notNull(), // ISO date string for Monday
  meals: text("meals").notNull(), // JSON: { mon_lunch: recipeId, mon_dinner: recipeId, ... }
});

export const pantryStaples = pgTable("pantry_staples", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  category: text("category").notNull(), // spices, oils, condiments, grains, etc.
});

export const userTasteProfiles = pgTable("user_taste_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  householdSize: integer("household_size").notNull().default(1),
  dislikedIngredients: text("disliked_ingredients"), // JSON array of strings
  likedCuisines: text("liked_cuisines"),             // JSON array of strings
  dietaryRestrictions: text("dietary_restrictions"), // JSON array: vegetarian, vegan, gluten-free, dairy-free, nut-free
  complexityPreference: text("complexity_preference").default("medium"), // easy, medium, any
  breakfastEnabled: integer("breakfast_enabled").notNull().default(0),
});

// Insert schemas (userId omitted from client-facing schemas — server sets it from session)
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertRecipeSchema = createInsertSchema(recipes).omit({ id: true, userId: true });
export const insertWeeklyPlanSchema = createInsertSchema(weeklyPlans).omit({ id: true, userId: true });
export const insertPantryStapleSchema = createInsertSchema(pantryStaples).omit({ id: true, userId: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type WeeklyPlan = typeof weeklyPlans.$inferSelect;
export type InsertWeeklyPlan = z.infer<typeof insertWeeklyPlanSchema>;
export type PantryStaple = typeof pantryStaples.$inferSelect;
export type InsertPantryStaple = z.infer<typeof insertPantryStapleSchema>;

export type UserTasteProfile = typeof userTasteProfiles.$inferSelect;

// Ingredient type for parsing
export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  category: string; // produce, protein, dairy, pantry, frozen, bakery
}
