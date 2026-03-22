import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertRecipeSchema, insertWeeklyPlanSchema, insertPantryStapleSchema } from "@shared/schema";

/**
 * Parse an ISO 8601 duration (e.g. PT1H30M, PT45M, PT2H) into minutes.
 */
function parseDuration(iso: string | undefined | null): number {
  if (!iso) return 0;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const mins = parseInt(match[2] || "0", 10);
  return hours * 60 + mins;
}

/**
 * Guess a store category from an ingredient name string.
 */
function guessCategory(name: string): string {
  const lower = name.toLowerCase();
  // Protein
  if (/chicken|beef|pork|sausage|turkey|shrimp|salmon|fish|bacon|steak|lamb|ground|roast/.test(lower)) return "protein";
  // Dairy
  if (/cheese|milk|cream|butter|yogurt|egg|sour cream/.test(lower)) return "dairy";
  // Frozen
  if (/frozen/.test(lower)) return "frozen";
  // Bakery
  if (/bread|rolls|bun|tortilla|naan|pita|hoagie|baguette/.test(lower)) return "bakery";
  // Produce
  if (/onion|garlic|pepper|tomato|lettuce|avocado|lime|lemon|cilantro|basil|ginger|broccoli|carrot|celery|potato|mushroom|spinach|kale|jalap|zucchini|corn|cucumber|herb|parsley|green onion|scallion/.test(lower)) return "produce";
  // Grains
  if (/rice|pasta|noodle|quinoa|oat|farro|couscous/.test(lower)) return "grains";
  // Condiments
  if (/sauce|vinegar|mustard|ketchup|mayo|sriracha|hot sauce|dressing|salsa/.test(lower)) return "condiments";
  // Default to pantry
  return "pantry";
}

/**
 * Guess cuisine from recipe title + ingredient list.
 */
function guessCuisine(title: string, ingredients: string[]): string {
  const blob = (title + " " + ingredients.join(" ")).toLowerCase();
  // Check Asian first — it has more specific markers that overlap with other cuisines
  if (/soy sauce|sesame|teriyaki|stir.?fry|wok|ramen|thai|curry|fish sauce|hoisin|kimchi|miso|pad kra|rice vinegar|bok choy|asian|chinese|japanese|korean|vietnamese|indian|tikka|masala|garam|tandoori|naan|basmati|paneer|samosa|szechuan|kung pao|lo mein|pho|bibimbap|bulgogi/.test(blob)) return "asian";
  if (/taco|enchilada|burrito|salsa|tortilla|quesadilla|fajita|carnitas|chipotle|jalap|tex.?mex|mexican|chile verde|tamale|queso/.test(blob)) return "tex-mex";
  if (/pasta|marinara|parmesan|mozzarella|italian|risotto|penne|fettuccine|lasagna|alfredo|prosciutto|bruschetta|bolognese|carbonara|pesto|gnocchi|ravioli|ciabatta/.test(blob)) return "italian";
  return "other";
}

/**
 * Parse a raw ingredient string like "2 cups all-purpose flour" into structured parts.
 */
function parseIngredientString(raw: string): { name: string; amount: number; unit: string } {
  // Clean up common fractions
  let s = raw.trim()
    .replace(/½/g, "0.5").replace(/⅓/g, "0.33").replace(/⅔/g, "0.67")
    .replace(/¼/g, "0.25").replace(/¾/g, "0.75")
    .replace(/⅛/g, "0.125")
    .replace(/ {2,}/g, " ");

  // Try to match: number (possibly with fraction) + optional unit + rest
  const match = s.match(/^([\d.]+(?:\s*\/\s*[\d.]+)?)\s*(cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|cloves?|cans?|whole|heads?|bunch(?:es)?|packs?|slices?|pieces?|stalks?|bags?)?\s*(.*)$/i);

  if (match) {
    let amount = 0;
    const amtStr = match[1];
    if (amtStr.includes("/")) {
      const [num, den] = amtStr.split("/").map(Number);
      amount = den ? num / den : num;
    } else {
      amount = parseFloat(amtStr) || 0;
    }
    const unit = (match[2] || "whole").toLowerCase().replace(/s$/, "");
    const name = match[3]?.replace(/^[,\s]+/, "").trim() || raw;
    return { name, amount, unit };
  }

  return { name: raw.trim(), amount: 1, unit: "whole" };
}

export async function registerRoutes(server: Server, app: Express) {
  // Seed default data on first run
  storage.seedDefaultData();

  // === RECIPES ===
  app.get("/api/recipes", (_req, res) => {
    const recipes = storage.getRecipes();
    res.json(recipes);
  });

  app.get("/api/recipes/:id", (req, res) => {
    const recipe = storage.getRecipe(Number(req.params.id));
    if (!recipe) return res.status(404).json({ error: "Recipe not found" });
    res.json(recipe);
  });

  app.post("/api/recipes", (req, res) => {
    const parsed = insertRecipeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const recipe = storage.createRecipe(parsed.data);
    res.status(201).json(recipe);
  });

  app.patch("/api/recipes/:id", (req, res) => {
    const recipe = storage.updateRecipe(Number(req.params.id), req.body);
    if (!recipe) return res.status(404).json({ error: "Recipe not found" });
    res.json(recipe);
  });

  app.delete("/api/recipes/:id", (req, res) => {
    storage.deleteRecipe(Number(req.params.id));
    res.status(204).send();
  });

  app.post("/api/recipes/:id/favorite", (req, res) => {
    const recipe = storage.toggleFavorite(Number(req.params.id));
    if (!recipe) return res.status(404).json({ error: "Recipe not found" });
    res.json(recipe);
  });

  // === WEEKLY PLANS ===
  app.get("/api/plans", (_req, res) => {
    const plans = storage.getWeeklyPlans();
    res.json(plans);
  });

  app.get("/api/plans/:weekStart", (req, res) => {
    const plan = storage.getWeeklyPlan(req.params.weekStart);
    if (!plan) return res.json({ weekStart: req.params.weekStart, meals: "{}" });
    res.json(plan);
  });

  app.post("/api/plans", (req, res) => {
    const parsed = insertWeeklyPlanSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const plan = storage.upsertWeeklyPlan(parsed.data);
    res.json(plan);
  });

  app.delete("/api/plans/:id", (req, res) => {
    storage.deleteWeeklyPlan(Number(req.params.id));
    res.status(204).send();
  });

  // === PANTRY STAPLES ===
  app.get("/api/staples", (_req, res) => {
    const staples = storage.getPantryStaples();
    res.json(staples);
  });

  app.post("/api/staples", (req, res) => {
    const parsed = insertPantryStapleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const staple = storage.createPantryStaple(parsed.data);
    res.status(201).json(staple);
  });

  app.delete("/api/staples/:id", (req, res) => {
    storage.deletePantryStaple(Number(req.params.id));
    res.status(204).send();
  });

  // === RECIPE IMPORT FROM URL ===
  app.post("/api/recipes/import-url", async (req, res) => {
    const { url } = req.body as { url: string };
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      // Fetch the page HTML
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return res.status(400).json({ error: `Could not fetch URL (${response.status})` });
      }

      const html = await response.text();

      // Strategy 1: Extract JSON-LD structured data (most popular recipe sites use this)
      const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
      let recipeData: any = null;

      if (jsonLdMatches) {
        for (const block of jsonLdMatches) {
          try {
            const jsonStr = block.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
            let parsed = JSON.parse(jsonStr);

            // Handle @graph arrays
            if (parsed["@graph"]) {
              parsed = parsed["@graph"].find((item: any) => item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe")));
            }
            // Handle arrays of objects
            if (Array.isArray(parsed)) {
              parsed = parsed.find((item: any) => item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe")));
            }
            // Direct Recipe object
            if (parsed && (parsed["@type"] === "Recipe" || (Array.isArray(parsed["@type"]) && parsed["@type"].includes("Recipe")))) {
              recipeData = parsed;
              break;
            }
          } catch {
            // JSON parse failed, try next block
          }
        }
      }

      if (!recipeData) {
        return res.status(400).json({ error: "Could not find recipe data on this page. Try a recipe from AllRecipes, Food Network, Tasty, Budget Bytes, Serious Eats, or similar sites." });
      }

      // Extract fields from JSON-LD
      const name = recipeData.name || "Imported Recipe";
      const description = recipeData.description || "";
      const prepTime = parseDuration(recipeData.prepTime);
      const cookTime = parseDuration(recipeData.cookTime) || parseDuration(recipeData.totalTime);
      const servings = parseInt(recipeData.recipeYield?.[0] || recipeData.recipeYield || "3", 10) || 3;

      // Parse ingredients
      const rawIngredients: string[] = recipeData.recipeIngredient || [];
      const ingredients = rawIngredients.map((raw: string) => {
        const parsed = parseIngredientString(raw);
        return {
          name: parsed.name,
          amount: parsed.amount,
          unit: parsed.unit,
          category: guessCategory(raw),
        };
      });

      // Parse instructions
      let instructions: string[] = [];
      if (recipeData.recipeInstructions) {
        if (Array.isArray(recipeData.recipeInstructions)) {
          instructions = recipeData.recipeInstructions.map((step: any) => {
            if (typeof step === "string") return step;
            if (step.text) return step.text;
            if (step.itemListElement) {
              return step.itemListElement.map((sub: any) => sub.text || sub).join(" ");
            }
            return String(step);
          });
        } else if (typeof recipeData.recipeInstructions === "string") {
          instructions = recipeData.recipeInstructions.split(/\n+/).filter((s: string) => s.trim());
        }
      }

      // Guess cuisine
      const cuisine = guessCuisine(name, rawIngredients);

      // Guess tags
      const tags: string[] = [];
      const lowerName = name.toLowerCase();
      if (/crock.?pot|slow.?cook|instant.?pot/.test(lowerName)) tags.push("crockpot");
      if (prepTime + cookTime <= 30 && prepTime + cookTime > 0) tags.push("quick");
      if (/one.?pot|one.?pan|sheet.?pan/.test(lowerName)) tags.push("one-pot");

      res.json({
        name,
        description: description.substring(0, 300),
        cuisine,
        mealType: "dinner",
        difficulty: (prepTime + cookTime) > 60 || instructions.length > 8 ? "medium" : "easy",
        prepTime,
        cookTime,
        servings,
        ingredients,
        instructions,
        tags,
        sourceUrl: url,
      });
    } catch (err: any) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        return res.status(408).json({ error: "Request timed out. The site may be slow or blocking requests." });
      }
      return res.status(500).json({ error: err.message || "Failed to import recipe" });
    }
  });

  // === SHOPPING LIST GENERATOR ===
  app.post("/api/shopping-list", (req, res) => {
    const { recipeIds } = req.body as { recipeIds: number[] };
    if (!recipeIds || !Array.isArray(recipeIds)) {
      return res.status(400).json({ error: "recipeIds array required" });
    }

    const staples = storage.getPantryStaples();
    const stapleNames = new Set(staples.map(s => s.name.toLowerCase()));

    // Collect all ingredients from selected recipes
    const ingredientMap = new Map<string, { name: string; amounts: string[]; category: string; isStaple: boolean }>();

    for (const id of recipeIds) {
      const recipe = storage.getRecipe(id);
      if (!recipe) continue;
      
      const ingredients = JSON.parse(recipe.ingredients) as Array<{
        name: string; amount: number; unit: string; category: string;
      }>;

      for (const ing of ingredients) {
        const key = ing.name.toLowerCase();
        const amountStr = `${ing.amount} ${ing.unit}`;
        const isStaple = stapleNames.has(key);

        if (ingredientMap.has(key)) {
          ingredientMap.get(key)!.amounts.push(amountStr);
        } else {
          ingredientMap.set(key, {
            name: ing.name,
            amounts: [amountStr],
            category: ing.category,
            isStaple,
          });
        }
      }
    }

    // Group by category
    const grouped: Record<string, Array<{ name: string; amounts: string[]; isStaple: boolean }>> = {};
    for (const [, item] of ingredientMap) {
      const cat = item.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({ name: item.name, amounts: item.amounts, isStaple: item.isStaple });
    }

    // Sort categories in a logical shopping order
    const categoryOrder = ["produce", "protein", "dairy", "frozen", "bakery", "pantry", "grains", "condiments"];
    const sortedGroups: Record<string, typeof grouped[string]> = {};
    for (const cat of categoryOrder) {
      if (grouped[cat]) {
        sortedGroups[cat] = grouped[cat].sort((a, b) => a.name.localeCompare(b.name));
      }
    }
    // Add any remaining categories
    for (const cat of Object.keys(grouped)) {
      if (!sortedGroups[cat]) {
        sortedGroups[cat] = grouped[cat].sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    res.json({
      totalItems: ingredientMap.size,
      recipeCount: recipeIds.length,
      categories: sortedGroups,
    });
  });
}
