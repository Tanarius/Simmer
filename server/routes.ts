import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import aiRoutes from "./routes/ai";
import onboardingRoutes from "./routes/onboarding";
import billingRoutes from "./routes/billing";
import snacksRoutes from "./routes/snacks";
import { requireAuth, isSafeUrl } from "./middleware/requireAuth";
import { insertRecipeSchema, insertWeeklyPlanSchema, insertPantryStapleSchema, type InsertWeeklyPlan } from "@shared/schema";
import { guessCategory, guessCuisine } from "./utils/categorization";
import { detectTags } from "./utils/autoTag";
import { buildShoppingList } from "./utils/shoppingList";
import { enrichWithNutrition } from "./services/spoonacular";

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

/**
 * Clean imported text by removing citation references and other junk markers
 */
function cleanImportedText(text: string): string {
  return text
    // Remove citation references like :contentReference[oaicite:0]{index=0}
    .replace(/:contentReference\[oaicite:\d+\]\{index:\d+\}/g, "")
    // Remove other common reference patterns
    .replace(/\[cite:\d+\]/g, "")
    .replace(/\[ref\s*\d+\]/gi, "")
    .replace(/\[\d+\]/g, "") // Remove [1], [2], etc at end of sentences
    // Remove multiple spaces
    .replace(/\s{2,}/g, " ")
    // Clean up spacing around punctuation
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

// Semaphore: max concurrent background recipe-clean Anthropic calls
let autoCleanActive = 0;

export async function registerRoutes(server: Server, app: Express) {
  // Setup Authentication
  setupAuth(app);

  // AI routes (all require auth)
  app.use("/api/ai", requireAuth, aiRoutes);

  // Billing — webhook is public (signature-verified), checkout/portal require auth (handled inside router)
  app.use("/api/billing", billingRoutes);


  // Onboarding routes (all require auth)
  app.use("/api/onboarding", requireAuth, onboardingRoutes);

  // Snacks & Shopping List
  app.use("/api/snacks", snacksRoutes);

  // Initialize database and seed default data on first run
  await storage.init();
  await storage.seedDefaultData();

  // === OG IMAGE PROXY ===
  // Extracts og:image from a recipe page URL server-side (avoids CORS)
  app.get("/api/proxy/og-image", async (req, res) => {
    const url = req.query.url as string;
    if (!url || !isSafeUrl(url)) return res.json({ imageUrl: null });
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; MealPrepApp/1.0; +https://mealprep.app)" },
        signal: AbortSignal.timeout(6000),
      });
      const html = await response.text();
      // Try multiple og:image patterns (property or name attribute order varies)
      const match =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
        html.match(/<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      const imageUrl = match?.[1]?.replace(/&amp;/g, "&") || null;
      return res.json({ imageUrl });
    } catch {
      return res.json({ imageUrl: null });
    }
  });

  // === DEV UTILITIES ===
  if (process.env.NODE_ENV !== "production") {
  // Upgrade a user to 'test' tier (50 AI calls/day) — dev only
  app.post("/api/dev/upgrade-testuser", async (req, res) => {

    try {
      const user = await storage.getUserByUsername("testuser");
      if (!user) return res.status(404).json({ error: "testuser not found" });
      await storage.updateUserSubscriptionTier(user.id, "test");
      res.json({ success: true, message: "testuser upgraded to test tier (50 AI calls/day)" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
  } // end dev-only block

  // === TASTE PROFILE ===
  app.get("/api/taste-profile", requireAuth, async (req, res) => {
    const profile = await storage.getUserTasteProfile((req.user as any).id);
    res.json(profile || {});
  });

  app.patch("/api/taste-profile", requireAuth, async (req, res) => {
    await storage.upsertUserTasteProfile((req.user as any).id, req.body);
    res.json({ success: true });
  });

  // === RECIPES ===
  app.get("/api/recipes", requireAuth, async (req, res) => {
    const householdId = (req.user as any).householdId;
    if (!householdId) return res.json([]); // no household yet — return empty rather than crash
    const recipes = await storage.getRecipes(householdId);
    res.json(recipes);
  });

  app.get("/api/recipes/:id", requireAuth, async (req, res) => {
    const householdId = (req.user as any).householdId;
    const recipe = await storage.getRecipe(Number(req.params.id), householdId);
    if (!recipe) return res.status(404).json({ error: "Recipe not found" });
    res.json(recipe);
  });

  app.post("/api/recipes", requireAuth, async (req, res) => {
    const householdId = (req.user as any).householdId;
    const parsed = insertRecipeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const recipe = await storage.createRecipe({ ...parsed.data, householdId });
    res.status(201).json(recipe);
    storage.logActivity((req.user as any).id, "recipe_added", recipe.id, recipe.name);

    // Fire-and-forget nutrition enrichment — don't block the response
    {
      let ingredientNames: string[] = [];
      try { ingredientNames = (JSON.parse(recipe.ingredients) as any[]).map(i => i.name).filter(Boolean); } catch { /* skip */ }
      if (ingredientNames.length > 0) {
        enrichWithNutrition(recipe.name, ingredientNames).then(nutrition => {
          if (nutrition) storage.updateRecipeNutrition(recipe.id, JSON.stringify(nutrition)).catch(() => {});
        }).catch(() => {});
      }
    }

    // Auto-clean instructions in background — best-effort, never blocks the response
    // Rate-limited: max 3 concurrent Anthropic calls to avoid burst costs
    if (!recipe.isProcessed && recipe.instructions && autoCleanActive < 3) {
      autoCleanActive++;
      setImmediate(async () => {
        try {
          const { cleanRecipe } = await import('./services/recipeCleaner');
          let ingredientsParsed: any[] = [];
          try { ingredientsParsed = JSON.parse(recipe.ingredients); } catch { /* skip */ }
          const cleaned = await cleanRecipe({ name: recipe.name, ingredients: ingredientsParsed, instructions: recipe.instructions || '' });
          const flatSteps = cleaned.sections.flatMap((s: any) => s.steps.map((st: any) => st.instruction ?? String(st)));
          await storage.updateRecipe(recipe.id, householdId, {
            isProcessed: true, rawInstructions: recipe.instructions,
            instructions: JSON.stringify(flatSteps), sections: cleaned.sections,
            cleanedSteps: cleaned.sections.flatMap((s: any) => s.steps),
            totalPrepTime: cleaned.totalPrepTime, totalCookTime: cleaned.totalCookTime,
            tips: cleaned.tips, difficulty: cleaned.difficulty,
          } as any);
        } catch (err) {
          console.error('[auto-clean] failed for recipe', recipe.id, (err as any)?.message);
        } finally {
          autoCleanActive--;
        }
      });
    }
  });

  app.patch("/api/recipes/:id", requireAuth, async (req, res) => {
    const householdId = (req.user as any).householdId;
    const recipe = await storage.updateRecipe(Number(req.params.id), householdId, req.body);
    if (!recipe) return res.status(404).json({ error: "Recipe not found" });
    res.json(recipe);
  });

  app.delete("/api/recipes/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const householdId = (req.user as any).householdId;
    const existing = await storage.getRecipe(id, householdId);
    await storage.deleteRecipe(id, householdId);
    res.status(204).send();
    if (existing) storage.logActivity((req.user as any).id, "recipe_deleted", id, existing.name);
  });

  app.post("/api/recipes/:id/favorite", requireAuth, async (req, res) => {
    const householdId = (req.user as any).householdId;
    const recipe = await storage.toggleFavorite(Number(req.params.id), householdId);
    if (!recipe) return res.status(404).json({ error: "Recipe not found" });
    res.json(recipe);
  });

  // === HOUSEHOLD ===
  // Rate limiter for join attempts: max 10 per IP per minute
  const joinAttempts = new Map<string, { count: number; resetAt: number }>();
  function checkJoinRate(ip: string): boolean {
    const now = Date.now();
    const slot = joinAttempts.get(ip);
    if (!slot || now >= slot.resetAt) { joinAttempts.set(ip, { count: 1, resetAt: now + 60_000 }); return true; }
    if (slot.count >= 10) return false;
    slot.count++;
    return true;
  }

  app.get("/api/household", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    const user = req.user as any;
    let householdId = user.householdId;
    // Auto-assign: if user somehow has no household (migration gap), create one now
    if (!householdId) {
      const { generateInviteCode } = await import("./utils/invite");
      const hh = await storage.createHousehold(`${user.username}'s Home`, generateInviteCode());
      await storage.setUserHousehold(user.id, hh.id);
      householdId = hh.id;
    }
    const hh = await storage.getHousehold(householdId);
    if (!hh) return res.status(404).json({ error: "Household not found" });
    const members = await storage.getHouseholdMembers(householdId);
    res.json({ ...hh, members: members.map(m => ({ id: m.id, username: m.username })) });
  });

  app.patch("/api/household/name", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    const user = req.user as any;
    if (!user.householdId) return res.status(404).json({ error: "No household" });
    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "Name required" });
    await storage.updateHouseholdName(user.householdId, name.trim());
    res.json({ success: true });
  });

  app.post("/api/household/join", async (req, res) => {
    const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown");
    if (!checkJoinRate(ip)) return res.status(429).json({ error: "Too many attempts. Try again in a minute." });
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    const user = req.user as any;
    const code = (req.body.inviteCode ?? "").trim().toUpperCase();
    if (!code || !/^[A-Z0-9]{8,20}$/.test(code)) return res.status(400).json({ error: "Invalid invite code format" });
    const hh = await storage.getHouseholdByInviteCode(code);
    if (!hh) return res.status(404).json({ error: "Invalid invite code" });
    await storage.setUserHousehold(user.id, hh.id);
    res.json(hh);
  });

  // Preview a household by invite code (public — no auth required)
  app.get("/api/household/preview/:code", async (req, res) => {
    const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown");
    if (!checkJoinRate(ip)) return res.status(429).json({ error: "Too many attempts." });
    const code = req.params.code.toUpperCase();
    const hh = await storage.getHouseholdByInviteCode(code);
    if (!hh) return res.status(404).json({ error: "Invalid invite code" });
    const members = await storage.getHouseholdMembers(hh.id);
    res.json({ id: hh.id, name: hh.name, memberCount: members.length });
  });

  // Regenerate invite code
  app.post("/api/household/regenerate", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    const user = req.user as any;
    if (!user.householdId) return res.status(404).json({ error: "No household" });
    const { generateInviteCode } = await import("./utils/invite");
    const newCode = generateInviteCode();
    await storage.updateHouseholdInviteCode(user.householdId, newCode);
    res.json({ inviteCode: newCode });
  });

  // Leave household (creates a new solo home)
  app.post("/api/household/leave", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    const user = req.user as any;
    if (!user.householdId) return res.status(404).json({ error: "No household" });
    const { generateInviteCode } = await import("./utils/invite");
    const code = generateInviteCode();
    const hh = await storage.createHousehold(`${user.username}'s Home`, code);
    await storage.setUserHousehold(user.id, hh.id);
    res.json(hh);
  });

  // === ACTIVITY FEED ===
  app.get("/api/activity", requireAuth, async (req, res) => {
    interface ActivityGroup {
      username: string; action: string; count: number;
      recipeNames: string[]; recipeIds: number[]; latestAt: string;
    }
    const householdId = (req.user as any).householdId;
    const rows = await storage.getRecentActivity(householdId, 40);
    const groups: ActivityGroup[] = [];
    for (const row of rows) {
      const last = groups[groups.length - 1];
      const sameWindow = last && last.username === row.username && last.action === row.action &&
        (new Date(last.latestAt).getTime() - new Date(row.createdAt).getTime()) < 10 * 60 * 1000;
      if (sameWindow) {
        last.count++;
        if (row.recipeName && !last.recipeNames.includes(row.recipeName)) {
          last.recipeNames.push(row.recipeName);
          if (row.recipeId) last.recipeIds.push(row.recipeId);
        }
      } else {
        groups.push({
          username: row.username, action: row.action, count: 1,
          recipeNames: row.recipeName ? [row.recipeName] : [],
          recipeIds: row.recipeId ? [row.recipeId] : [],
          latestAt: row.createdAt.toISOString(),
        });
      }
      if (groups.length >= 8) break;
    }
    res.json(groups);
  });

  // === WEEKLY PLANS ===
  app.get("/api/plans", requireAuth, async (req, res) => {
    const householdId = (req.user as any).householdId;
    const plans = await storage.getWeeklyPlans(householdId);
    res.json(plans);
  });

  app.get("/api/plans/:weekStart", requireAuth, async (req, res) => {
    const householdId = (req.user as any).householdId;
    const plan = await storage.getWeeklyPlan(req.params.weekStart as string, householdId);
    if (!plan) return res.json({ weekStart: req.params.weekStart, meals: "{}" });
    res.json(plan);
  });

  app.post("/api/plans", requireAuth, async (req, res) => {
    const householdId = (req.user as any).householdId;
    const parsed = insertWeeklyPlanSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const existing = await storage.getWeeklyPlan(parsed.data.weekStart, householdId);
    const planData: InsertWeeklyPlan = { ...parsed.data, householdId };
    if (req.body.mealMeta !== undefined) (planData as any).mealMeta = req.body.mealMeta;
    const plan = await storage.upsertWeeklyPlan(planData);
    res.json(plan);
    // Diff-based activity logging — log each newly added recipe
    if (existing?.meals !== parsed.data.meals) {
      const userId = (req.user as any).id;
      const oldMeals: Record<string, any> = existing?.meals ? JSON.parse(existing.meals) : {};
      const newMeals: Record<string, any> = JSON.parse(parsed.data.meals);
      const oldVals = new Set(Object.values(oldMeals).map(String));
      let added = 0;
      for (const val of Object.values(newMeals)) {
        if (typeof val === "number" && !oldVals.has(String(val))) {
          const recipe = await storage.getRecipe(val, householdId);
          storage.logActivity(userId, "plan_meal_added", val, recipe?.name ?? null);
          added++;
        }
      }
      if (added === 0) storage.logActivity(userId, "plan_updated");
    }
  });

  app.delete("/api/plans/:id", requireAuth, async (req, res) => {
    const householdId = (req.user as any).householdId;
    await storage.deleteWeeklyPlan(Number(req.params.id), householdId);
    res.status(204).send();
  });

  // === MEAL REACTIONS ===
  app.get("/api/plans/:weekStart/reactions", requireAuth, async (req, res) => {
    const householdId = (req.user as any).householdId;
    const reactions = await storage.getReactionsForWeek(req.params.weekStart as string, householdId);
    res.json(reactions);
  });

  app.post("/api/plans/:weekStart/reactions", requireAuth, async (req, res) => {
    const householdId = (req.user as any).householdId;
    const weekStart = req.params.weekStart as string;
    const { slotKey, emoji } = req.body;
    const userId = (req.user as any).id;
    if (!slotKey) return res.status(400).json({ error: "slotKey required" });
    // Verify the week plan belongs to this household before accepting reactions
    const plan = await storage.getWeeklyPlan(weekStart, householdId);
    if (!plan) return res.status(403).json({ error: "Forbidden" });
    if (!emoji) {
      await storage.deleteReaction(weekStart, slotKey, userId);
    } else {
      await storage.upsertReaction(weekStart, slotKey, userId, emoji);
    }
    res.status(204).send();
  });

  // === PANTRY STAPLES ===
  app.get("/api/staples", requireAuth, async (req, res) => {
    const householdId = (req.user as any).householdId;
    const staples = await storage.getPantryStaples(householdId);
    res.json(staples);
  });

  app.post("/api/staples", requireAuth, async (req, res) => {
    const householdId = (req.user as any).householdId;
    const parsed = insertPantryStapleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const staple = await storage.createPantryStaple({ ...parsed.data, householdId });
    res.status(201).json(staple);
    storage.logActivity((req.user as any).id, "pantry_added", null, staple.name);
  });

  app.delete("/api/staples/:id", requireAuth, async (req, res) => {
    const householdId = (req.user as any).householdId;
    await storage.deletePantryStaple(Number(req.params.id), householdId);
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
      "Accept-Encoding": "gzip, deflate, br",
      "Referer": "https://www.google.com/",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site",
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
        if (html.includes("application/ld+json") || html.includes("recipeIngredient")) {
          return html;
        }
      }
    } catch {
      // Direct fetch failed, try archive
    }

    // Strategy 2: Internet Archive (Wayback Machine) — works for Cloudflare-protected sites
    // like AllRecipes that block direct server requests
    try {
      const availRes = await fetch(
        `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (availRes.ok) {
        const availJson = await availRes.json() as any;
        const snapshotUrl: string | undefined = availJson?.archived_snapshots?.closest?.url;
        if (snapshotUrl) {
          const res = await fetch(snapshotUrl, { headers, redirect: "follow", signal: AbortSignal.timeout(12000) });
          if (res.ok) {
            const html = await res.text();
            if (html.includes("application/ld+json") || html.includes("recipeIngredient")) {
              return html;
            }
          }
        }
      }
    } catch {
      // Archive fallback failed too
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

  /**
   * Fallback: Try to extract recipe from HTML using common microdata/meta tags
   */
  function extractRecipeFallback(html: string): any {
    // Look for recipe name in meta tags or headings
    const nameMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<h1[^>]*class=["'][^"']*recipe[^"']*["'][^>]*>([^<]+)<\/h1>/i) ||
                      html.match(/<h1[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([^<]+)<\/h1>/i) ||
                      html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const name = nameMatch ? cleanImportedText(decodeHtmlEntities(nameMatch[1].trim())) : "Imported Recipe";

    // Look for description in meta tags
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const description = descMatch ? cleanImportedText(decodeHtmlEntities(descMatch[1].trim())) : "";

    // Strategy 1: Look for ingredients with specific classes/attributes
    let ingredientMatches = Array.from(html.matchAll(/<li[^>]*class=["'][^"']*ingredient[^"']*["'][^>]*>([^<]+)<\/li>/gi));
    if (ingredientMatches.length === 0) {
      ingredientMatches = Array.from(html.matchAll(/<span[^>]*itemprop=["']recipeIngredient["'][^>]*>([^<]+)<\/span>/gi));
    }
    if (ingredientMatches.length === 0) {
      ingredientMatches = Array.from(html.matchAll(/data-ingredient=["']([^"']+)["']/gi));
    }

    // Strategy 2: If no specific markup, look for lists that might be ingredients
    // Look for common ingredient patterns (starts with number or fraction)
    if (ingredientMatches.length === 0) {
      // Find all <li> tags and filter for ones that look like ingredients
      const allListItems = Array.from(html.matchAll(/<li[^>]*>([^<]+(?:<[^>]+>[^<]*<\/[^>]+>)*[^<]*)<\/li>/gi));
      ingredientMatches = allListItems.filter(match => {
        const text = match[1].replace(/<[^>]*>/g, "").trim();
        // Ingredient pattern: starts with number, fraction, or common measurement words
        return /^(\d+\/?\d*|\d*\.?\d+)?\s*(cup|tbsp|tsp|tablespoon|teaspoon|oz|lb|pound|g|kg|ml|clove|piece|can|package|bunch)?s?\s+/i.test(text) ||
               /^(one|two|three|four|five|six|seven|eight|a|an)\s+(cup|tablespoon|teaspoon|pound|can|piece)/i.test(text);
      });
    }

    const ingredients = ingredientMatches.length > 0
      ? ingredientMatches.map(m => cleanImportedText(decodeHtmlEntities(m[1].replace(/<[^>]*>/g, "").trim()))).filter(i => i.length > 0 && i.length < 200)
      : [];

    // Strategy 1: Look for instructions with specific classes
    let instructionMatches = Array.from(html.matchAll(/<li[^>]*class=["'][^"']*instruction[^"']*["'][^>]*>([^<]+)<\/li>/gi));
    if (instructionMatches.length === 0) {
      instructionMatches = Array.from(html.matchAll(/<div[^>]*class=["'][^"']*step[^"']*["'][^>]*>([^<]+)<\/div>/gi));
    }
    if (instructionMatches.length === 0) {
      instructionMatches = Array.from(html.matchAll(/<span[^>]*itemprop=["']recipeInstructions["'][^>]*>([^<]+)<\/span>/gi));
    }

    // Strategy 2: Look for ordered lists (often instructions)
    if (instructionMatches.length === 0) {
      // Find ordered lists that might contain instructions
      const olMatch = html.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
      if (olMatch) {
        instructionMatches = Array.from(olMatch[1].matchAll(/<li[^>]*>(.*?)<\/li>/gi));
      }
    }

    const instructions = instructionMatches.length > 0
      ? instructionMatches.map(m => cleanImportedText(decodeHtmlEntities(m[1].replace(/<[^>]*>/g, "").trim()))).filter(i => i.length > 0)
      : [];

    // Look for image
    const imageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<img[^>]*class=["'][^"']*recipe[^"']*["'][^>]*src=["']([^"']+)["']/i);
    const image = imageMatch ? imageMatch[1] : null;

    // Only return if we found at least a name and some ingredients
    if (name && ingredients.length > 2) {
      return {
        name,
        description,
        recipeIngredient: ingredients,
        recipeInstructions: instructions.length > 0 ? instructions : undefined,
        image,
      };
    }

    return null;
  }

  app.post("/api/recipes/import-url", requireAuth, async (req, res) => {
    const { url } = req.body as { url: string };
    if (!url || !isSafeUrl(url)) return res.status(400).json({ error: "URL is required and must be a public URL" });

    try {
      const html = await fetchHtml(url);
      let recipeData = extractRecipeJsonLd(html);

      // If JSON-LD extraction failed, try fallback HTML parsing
      if (!recipeData) {
        recipeData = extractRecipeFallback(html);
      }

      if (!recipeData) {
        return res.status(400).json({ error: "Could not find recipe data on this page. The site may not include structured recipe data. Try copying the recipe details manually." });
      }

      // Extract fields from JSON-LD
      const name = cleanImportedText(decodeHtmlEntities((recipeData.name || "Imported Recipe").replace(/<[^>]*>/g, "")));
      const description = cleanImportedText(decodeHtmlEntities((recipeData.description || "").replace(/<[^>]*>/g, ""))); // strip HTML tags + entities
      const prepTime = parseDuration(recipeData.prepTime);
      const cookTime = parseDuration(recipeData.cookTime) || parseDuration(recipeData.totalTime);
      const servings = parseInt(recipeData.recipeYield?.[0] || recipeData.recipeYield || "3", 10) || 3;

      // Parse ingredients
      const rawIngredients: string[] = recipeData.recipeIngredient || [];
      if (rawIngredients.length === 0) {
        console.warn(`No ingredients found for URL: ${url}`);
      }
      const ingredients = rawIngredients.map((raw: string) => {
        const clean = cleanImportedText(decodeHtmlEntities(raw.replace(/<[^>]*>/g, "").trim())); // strip HTML, decode entities, and clean references
        const parsed = parseIngredientString(clean);
        return {
          name: parsed.name,
          amount: parsed.amount,
          unit: parsed.unit,
          category: guessCategory(clean),
        };
      }).filter(ing => ing.name && ing.name.length > 0); // Filter out empty ingredients

      // Parse instructions
      let instructions: string[] = [];
      if (recipeData.recipeInstructions) {
        if (Array.isArray(recipeData.recipeInstructions)) {
          instructions = recipeData.recipeInstructions.map((step: any) => {
            if (typeof step === "string") return cleanImportedText(decodeHtmlEntities(step.replace(/<[^>]*>/g, "").trim()));
            if (step.text) return cleanImportedText(decodeHtmlEntities(step.text.replace(/<[^>]*>/g, "").trim()));
            if (step.itemListElement) {
              return step.itemListElement.map((sub: any) => cleanImportedText(decodeHtmlEntities((sub.text || String(sub)).replace(/<[^>]*>/g, "").trim()))).join(" ");
            }
            return cleanImportedText(decodeHtmlEntities(String(step).replace(/<[^>]*>/g, "").trim()));
          }).filter((s: string) => s.length > 0);
        } else if (typeof recipeData.recipeInstructions === "string") {
          instructions = recipeData.recipeInstructions.replace(/<[^>]*>/g, "").split(/\n+/).filter((s: string) => s.trim()).map((s: string) => cleanImportedText(decodeHtmlEntities(s.trim())));
        }
      }

      // Validate we got enough data
      if (ingredients.length === 0) {
        return res.status(400).json({
          error: "Found recipe but no ingredients could be extracted. The site's format may not be supported. Try copying the recipe details manually."
        });
      }

      // Guess cuisine
      const cuisine = guessCuisine(name, rawIngredients);

      // Guess tags
      const tags = detectTags(name, prepTime + cookTime);

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
  app.post("/api/shopping-list", requireAuth, async (req, res) => {
    const { recipeIds } = req.body as { recipeIds: number[] };
    if (!recipeIds || !Array.isArray(recipeIds)) {
      return res.status(400).json({ error: "recipeIds array required" });
    }
    const householdId = (req.user as any).householdId;
    const staples = await storage.getPantryStaples(householdId);
    const stapleNames = new Set(staples.map(s => s.name.toLowerCase()));

    // Collect all ingredients from selected recipes
    const allIngredients: Array<{ name: string; amount: number; unit: string }> = [];
    for (const id of recipeIds) {
      const recipe = await storage.getRecipe(id, householdId);
      if (!recipe) continue;
      try {
        const parsed: Array<{ name: string; amount: number; unit: string }> =
          recipe.ingredients ? JSON.parse(recipe.ingredients) : [];
        allIngredients.push(...parsed);
      } catch {
        console.warn(`Skipping recipe ${recipe.id}: malformed ingredients JSON`);
      }
    }

    const { totalItems, categories } = buildShoppingList(allIngredients, stapleNames);
    res.json({ totalItems, recipeCount: recipeIds.length, categories });
  });
}
