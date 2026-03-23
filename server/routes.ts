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
  // Clean up common unicode fractions — replace with space + fraction so "1½" becomes "1 1/2"
  let s = raw.trim()
    .replace(/½/g, " 1/2").replace(/⅓/g, " 1/3").replace(/⅔/g, " 2/3")
    .replace(/¼/g, " 1/4").replace(/¾/g, " 3/4")
    .replace(/⅛/g, " 1/8").replace(/⅜/g, " 3/8").replace(/⅝/g, " 5/8").replace(/⅞/g, " 7/8")
    .replace(/⅙/g, " 1/6").replace(/⅚/g, " 5/6")
    .replace(/ {2,}/g, " ")
    .trim();

  const units = "cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|cloves?|cans?|heads?|bunch(?:es)?|packages?|packs?|slices?|pieces?|stalks?|bags?|quarts?|gallons?|pints?|liters?|ml|grams?|g|kg|dash(?:es)?|pinch(?:es)?|sprigs?|leaves|sticks?";

  // Strategy: try multiple patterns from most specific to least

  // Pattern 1: "1 1/2 cups flour" — whole + fraction + unit + name
  let match = s.match(new RegExp(`^(\\d+)\\s+(\\d+)\\s*/\\s*(\\d+)\\s+(${units})\\s+(.+)$`, "i"));
  if (match) {
    const amount = Math.round((parseInt(match[1]) + parseInt(match[2]) / parseInt(match[3])) * 100) / 100;
    return { amount, unit: match[4].toLowerCase().replace(/s$/, ""), name: match[5].trim() };
  }

  // Pattern 2: "1/3 cup butter" — fraction + unit + name
  match = s.match(new RegExp(`^(\\d+)\\s*/\\s*(\\d+)\\s+(${units})\\s+(.+)$`, "i"));
  if (match) {
    const amount = Math.round((parseInt(match[1]) / parseInt(match[2])) * 100) / 100;
    return { amount, unit: match[3].toLowerCase().replace(/s$/, ""), name: match[4].trim() };
  }

  // Pattern 3: "1 package (14.1 ounces) pie crusts" — number + unit + parenthetical + name
  match = s.match(new RegExp(`^([\\d.]+)\\s+(${units})\\s*\\([^)]*\\)\\s*(.+)$`, "i"));
  if (match) {
    return { amount: Math.round(parseFloat(match[1]) * 100) / 100, unit: match[2].toLowerCase().replace(/s$/, ""), name: match[3].trim() };
  }

  // Pattern 4: "1 (10.75 ounce) can cream of chicken" — number + parenthetical-unit + unit + name
  match = s.match(/^([\d.]+)\s*\([^)]*\)\s*(\w+)\s+(.+)$/i);
  if (match) {
    return { amount: Math.round(parseFloat(match[1]) * 100) / 100, unit: match[2].toLowerCase().replace(/s$/, ""), name: match[3].trim() };
  }

  // Pattern 5: "2 cups chicken" — whole + unit + name
  match = s.match(new RegExp(`^([\\d.]+)\\s+(${units})\\s+(.+)$`, "i"));
  if (match) {
    return { amount: Math.round(parseFloat(match[1]) * 100) / 100, unit: match[2].toLowerCase().replace(/s$/, ""), name: match[3].trim() };
  }

  // Pattern 6: "3 large eggs" or "2 avocados" — number + name (no recognized unit)
  match = s.match(/^([\d.]+)\s+(.+)$/i);
  if (match) {
    return { amount: Math.round(parseFloat(match[1]) * 100) / 100, unit: "whole", name: match[2].trim() };
  }

  // Pattern 7: just a fraction "1/2" + name — no unit
  match = s.match(/^(\d+)\s*\/\s*(\d+)\s+(.+)$/i);
  if (match) {
    const amount = Math.round((parseInt(match[1]) / parseInt(match[2])) * 100) / 100;
    return { amount, unit: "whole", name: match[3].trim() };
  }

  // Fallback: no number found, just use the whole string as the name
  return { name: raw.trim(), amount: 1, unit: "whole" };
}

/**
 * Decode common HTML entities in text.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/g, "/")
    .replace(/&#\d+;/g, (match) => {
      const code = parseInt(match.replace(/&#|;/g, ""), 10);
      return String.fromCharCode(code);
    });
}

export async function registerRoutes(server: Server, app: Express) {
  // Initialize database and seed default data on first run
  await storage.init();
  await storage.seedDefaultData();

  // === RECIPES ===
  app.get("/api/recipes", async (_req, res) => {
    const recipes = await storage.getRecipes();
    res.json(recipes);
  });

  app.get("/api/recipes/:id", async (req, res) => {
    const recipe = await storage.getRecipe(Number(req.params.id));
    if (!recipe) return res.status(404).json({ error: "Recipe not found" });
    res.json(recipe);
  });

  app.post("/api/recipes", async (req, res) => {
    const parsed = insertRecipeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const recipe = await storage.createRecipe(parsed.data);
    res.status(201).json(recipe);
  });

  app.patch("/api/recipes/:id", async (req, res) => {
    const recipe = await storage.updateRecipe(Number(req.params.id), req.body);
    if (!recipe) return res.status(404).json({ error: "Recipe not found" });
    res.json(recipe);
  });

  app.delete("/api/recipes/:id", async (req, res) => {
    await storage.deleteRecipe(Number(req.params.id));
    res.status(204).send();
  });

  app.post("/api/recipes/:id/favorite", async (req, res) => {
    const recipe = await storage.toggleFavorite(Number(req.params.id));
    if (!recipe) return res.status(404).json({ error: "Recipe not found" });
    res.json(recipe);
  });

  // === WEEKLY PLANS ===
  app.get("/api/plans", async (_req, res) => {
    const plans = await storage.getWeeklyPlans();
    res.json(plans);
  });

  app.get("/api/plans/:weekStart", async (req, res) => {
    const plan = await storage.getWeeklyPlan(req.params.weekStart);
    if (!plan) return res.json({ weekStart: req.params.weekStart, meals: "{}" });
    res.json(plan);
  });

  app.post("/api/plans", async (req, res) => {
    const parsed = insertWeeklyPlanSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const plan = await storage.upsertWeeklyPlan(parsed.data);
    res.json(plan);
  });

  app.delete("/api/plans/:id", async (req, res) => {
    await storage.deleteWeeklyPlan(Number(req.params.id));
    res.status(204).send();
  });

  // === PANTRY STAPLES ===
  app.get("/api/staples", async (_req, res) => {
    const staples = await storage.getPantryStaples();
    res.json(staples);
  });

  app.post("/api/staples", async (req, res) => {
    const parsed = insertPantryStapleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const staple = await storage.createPantryStaple(parsed.data);
    res.status(201).json(staple);
  });

  app.delete("/api/staples/:id", async (req, res) => {
    await storage.deletePantryStaple(Number(req.params.id));
    res.status(204).send();
  });

  // === RECIPE IMPORT FROM URL ===

  /**
   * Attempt to fetch a URL's HTML using multiple strategies.
   * Some recipe sites (AllRecipes, Dotdash Meredith) block server-side requests.
   */
  async function fetchHtml(url: string): Promise<string> {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "identity",
      "Cache-Control": "no-cache",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    };

    // Strategy 1: Direct fetch
    try {
      const res = await fetch(url, {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        const html = await res.text();
        // Verify we got actual HTML and not an error page
        if (html.includes("application/ld+json") || html.includes("recipeIngredient") || html.length > 5000) {
          return html;
        }
      }
    } catch {
      // Direct fetch failed, try proxies
    }

    // Strategy 2: Google cache
    try {
      const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
      const res = await fetch(cacheUrl, {
        headers: { ...headers, "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const html = await res.text();
        if (html.includes("application/ld+json") || html.includes("recipeIngredient")) {
          return html;
        }
      }
    } catch {
      // Google cache failed too
    }

    // Strategy 3: Try corsproxy.io
    try {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, {
        headers: { "User-Agent": headers["User-Agent"] },
        redirect: "follow",
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        const html = await res.text();
        if (html.includes("application/ld+json") || html.includes("recipeIngredient") || html.length > 5000) {
          return html;
        }
      }
    } catch {
      // Proxy also failed
    }

    throw new Error("Could not reach this recipe site. The site may be blocking automated requests. Try copying the recipe details manually.");
  }

  /**
   * Extract JSON-LD Recipe data from HTML.
   */
  function extractRecipeJsonLd(html: string): any {
    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
    if (!jsonLdMatches) return null;

    for (const block of jsonLdMatches) {
      try {
        const jsonStr = block.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
        let parsed = JSON.parse(jsonStr);

        // Handle @graph arrays
        if (parsed["@graph"]) {
          const found = parsed["@graph"].find((item: any) =>
            item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))
          );
          if (found) return found;
        }
        // Handle arrays of objects
        if (Array.isArray(parsed)) {
          const found = parsed.find((item: any) =>
            item["@type"] === "Recipe" || (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))
          );
          if (found) return found;
        }
        // Direct Recipe object
        if (parsed && (parsed["@type"] === "Recipe" || (Array.isArray(parsed["@type"]) && parsed["@type"].includes("Recipe")))) {
          return parsed;
        }
      } catch {
        // JSON parse failed, try next block
      }
    }
    return null;
  }

  app.post("/api/recipes/import-url", async (req, res) => {
    const { url } = req.body as { url: string };
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      const html = await fetchHtml(url);
      const recipeData = extractRecipeJsonLd(html);

      if (!recipeData) {
        return res.status(400).json({ error: "Could not find recipe data on this page. The site may not include structured recipe data." });
      }

      // Extract fields from JSON-LD
      const name = decodeHtmlEntities((recipeData.name || "Imported Recipe").replace(/<[^>]*>/g, ""));
      const description = decodeHtmlEntities((recipeData.description || "").replace(/<[^>]*>/g, "")); // strip HTML tags + entities
      const prepTime = parseDuration(recipeData.prepTime);
      const cookTime = parseDuration(recipeData.cookTime) || parseDuration(recipeData.totalTime);
      const servings = parseInt(recipeData.recipeYield?.[0] || recipeData.recipeYield || "3", 10) || 3;

      // Parse ingredients
      const rawIngredients: string[] = recipeData.recipeIngredient || [];
      const ingredients = rawIngredients.map((raw: string) => {
        const clean = raw.replace(/<[^>]*>/g, "").trim(); // strip HTML
        const parsed = parseIngredientString(clean);
        return {
          name: parsed.name,
          amount: parsed.amount,
          unit: parsed.unit,
          category: guessCategory(clean),
        };
      });

      // Parse instructions
      let instructions: string[] = [];
      if (recipeData.recipeInstructions) {
        if (Array.isArray(recipeData.recipeInstructions)) {
          instructions = recipeData.recipeInstructions.map((step: any) => {
            if (typeof step === "string") return step.replace(/<[^>]*>/g, "").trim();
            if (step.text) return step.text.replace(/<[^>]*>/g, "").trim();
            if (step.itemListElement) {
              return step.itemListElement.map((sub: any) => (sub.text || String(sub)).replace(/<[^>]*>/g, "").trim()).join(" ");
            }
            return String(step).replace(/<[^>]*>/g, "").trim();
          }).filter((s: string) => s.length > 0);
        } else if (typeof recipeData.recipeInstructions === "string") {
          instructions = recipeData.recipeInstructions.replace(/<[^>]*>/g, "").split(/\n+/).filter((s: string) => s.trim());
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

      // Extract image URL from JSON-LD
      let imageUrl: string | null = null;
      if (recipeData.image) {
        if (typeof recipeData.image === "string") {
          imageUrl = recipeData.image;
        } else if (Array.isArray(recipeData.image)) {
          imageUrl = typeof recipeData.image[0] === "string" ? recipeData.image[0] : recipeData.image[0]?.url || null;
        } else if (recipeData.image.url) {
          imageUrl = recipeData.image.url;
        }
      }

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
        imageUrl,
        sourceUrl: url,
      });
    } catch (err: any) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        return res.status(408).json({ error: "Request timed out. The site may be slow or blocking requests." });
      }
      return res.status(400).json({ error: err.message || "Failed to import recipe" });
    }
  });

  // === SHOPPING LIST GENERATOR ===
  app.post("/api/shopping-list", async (req, res) => {
    const { recipeIds } = req.body as { recipeIds: number[] };
    if (!recipeIds || !Array.isArray(recipeIds)) {
      return res.status(400).json({ error: "recipeIds array required" });
    }

    const staples = await storage.getPantryStaples();
    const stapleNames = new Set(staples.map(s => s.name.toLowerCase()));

    // Collect all ingredients from selected recipes
    const ingredientMap = new Map<string, { name: string; amounts: string[]; category: string; isStaple: boolean }>();

    for (const id of recipeIds) {
      const recipe = await storage.getRecipe(id);
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
