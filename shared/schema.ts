import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const recipes = sqliteTable("recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  cuisine: text("cuisine").notNull(), // tex-mex, italian, asian, american, other
  mealType: text("meal_type").notNull(), // lunch, dinner, either
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

export const weeklyPlans = sqliteTable("weekly_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  weekStart: text("week_start").notNull(), // ISO date string for Monday
  meals: text("meals").notNull(), // JSON: { mon_lunch: recipeId, mon_dinner: recipeId, ... }
});

export const pantryStaples = sqliteTable("pantry_staples", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull(), // spices, oils, condiments, grains, etc.
});

// Insert schemas
export const insertRecipeSchema = createInsertSchema(recipes).omit({ id: true });
export const insertWeeklyPlanSchema = createInsertSchema(weeklyPlans).omit({ id: true });
export const insertPantryStapleSchema = createInsertSchema(pantryStaples).omit({ id: true });

// Types
export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type WeeklyPlan = typeof weeklyPlans.$inferSelect;
export type InsertWeeklyPlan = z.infer<typeof insertWeeklyPlanSchema>;
export type PantryStaple = typeof pantryStaples.$inferSelect;
export type InsertPantryStaple = z.infer<typeof insertPantryStapleSchema>;

// Ingredient type for parsing
export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  category: string; // produce, protein, dairy, pantry, frozen, bakery
}
