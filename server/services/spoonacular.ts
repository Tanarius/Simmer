import axios from "axios";
import { searchRecipesEdamam } from "./edamam";

export interface NutritionData {
  calories: number;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
}

export interface SpoonacularRecipe {
  id: number;
  title: string;
  imageUrl: string;       // direct CDN URL — always matches the dish
  sourceUrl: string;      // verified original recipe page
  readyInMinutes: number;
  servings: number;
  summary: string;        // plain text description (HTML stripped)
  cuisines: string[];
  dishTypes: string[];
  diets: string[];
  ingredients: { name: string; amount: number; unit: string; original: string }[];
  instructions: string[]; // ordered step strings
}

export interface RecipeImageResult {
  imageUrl: string | null;
  sourceUrl: string | null;
  spoonacularId: number | null;
}

// ─── URL recipe extraction (handles Cloudflare-protected sites like AllRecipes) ─

/**
 * Use Spoonacular's /recipes/extract endpoint to scrape a recipe from any URL.
 * Costs ~50 Spoonacular points. Returns null if no API key or request fails.
 */
export async function extractRecipeByUrl(url: string): Promise<SpoonacularRecipe | null> {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await axios.get('https://api.spoonacular.com/recipes/extract', {
      params: { url, analyze: false, addRecipeInformation: true, apiKey },
      timeout: 15000,
    });
    const d = res.data;
    if (!d?.title) return null;

    // Strip HTML from summary
    const summary = (d.summary ?? '').replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ').trim();

    // Map extendedIngredients → our ingredient shape
    const ingredients = (d.extendedIngredients ?? []).map((i: any) => ({
      name: i.nameClean ?? i.name ?? i.originalName ?? '',
      amount: i.amount ?? 0,
      unit: i.unit ?? '',
      original: i.original ?? '',
    })).filter((i: any) => i.name);

    // Flatten analyzedInstructions → ordered step strings
    const instructions: string[] = [];
    for (const block of d.analyzedInstructions ?? []) {
      for (const step of block.steps ?? []) {
        if (step.step) instructions.push(step.step);
      }
    }

    return {
      id: d.id ?? 0,
      title: d.title,
      imageUrl: d.image ?? '',
      sourceUrl: d.sourceUrl ?? url,
      readyInMinutes: d.readyInMinutes ?? 0,
      servings: d.servings ?? 4,
      summary,
      cuisines: d.cuisines ?? [],
      dishTypes: d.dishTypes ?? [],
      diets: d.diets ?? [],
      ingredients,
      instructions,
    };
  } catch {
    return null;
  }
}

// ─── Nutrition enrichment (existing) ─────────────────────────────────────────

export async function enrichWithNutrition(recipeName: string, ingredients: string[]): Promise<NutritionData | null> {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) return null;

  try {
    const ingredientsQuery = ingredients.join(',');
    const searchRes = await axios.get(`https://api.spoonacular.com/recipes/findByIngredients`, {
      params: { ingredients: ingredientsQuery, number: 1, apiKey },
    });
    if (!searchRes.data?.length) return null;

    const recipeId = searchRes.data[0].id;
    const nutritionRes = await axios.get(`https://api.spoonacular.com/recipes/${recipeId}/nutritionWidget.json`, {
      params: { apiKey },
    });
    const data = nutritionRes.data;
    const fiberObj = data.good?.find((n: any) => n.title === 'Fiber');
    return {
      calories: data.calories ? parseInt(data.calories) : 0,
      protein: data.protein || '0g',
      carbs: data.carbs || '0g',
      fat: data.fat || '0g',
      fiber: fiberObj ? fiberObj.amount : '0g',
    };
  } catch {
    return null;
  }
}

// ─── Image lookup for a named recipe (used by copilot execute-tool) ───────────

const STRIP_ADJ = /^(classic|homemade|easy|quick|simple|perfect|best|sheet pan|fresh|healthy|crispy|creamy|loaded|ultimate|slow cooker|one[ -]pot|one[ -]pan|instant pot|air fryer)\s+/i;
function simplifyName(name: string): string {
  return name.replace(STRIP_ADJ, "").trim();
}

async function spoonacularImageSearch(query: string, apiKey: string): Promise<string | null> {
  try {
    const res = await axios.get("https://api.spoonacular.com/recipes/complexSearch", {
      params: { query, number: 1, addRecipeInformation: false, apiKey },
      timeout: 5000,
    });
    const r = res.data?.results?.[0];
    return r?.image ? String(r.image).replace(/-\d+x\d+\./, "-636x393.") : null;
  } catch { return null; }
}

export async function searchRecipeImage(recipeName: string): Promise<RecipeImageResult> {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  const simplified = simplifyName(recipeName);

  if (apiKey) {
    // Build query variants: full → adjective-stripped → drop last word (for "X Y Bowl/Pasta/etc.")
    const words = simplified.split(" ");
    const dropLast  = words.length > 2 ? words.slice(0, -1).join(" ") : null;
    const lastTwo   = words.length > 2 ? words.slice(-2).join(" ") : null;
    const queries = [
      recipeName,
      ...(simplified !== recipeName ? [simplified] : []),
      ...(dropLast ? [dropLast] : []),
      ...(lastTwo  ? [lastTwo]  : []),
    ];
    for (const query of queries) {
      const url = await spoonacularImageSearch(query, apiKey);
      if (url) return { imageUrl: url, sourceUrl: null, spoonacularId: null };
    }
  }

  // Free fallback: TheMealDB — try simplified first (shorter = better match)
  for (const name of [simplified, recipeName]) {
    try {
      const q = encodeURIComponent(name.split(" ").slice(0, 3).join(" "));
      const res = await axios.get(`https://www.themealdb.com/api/json/v1/1/search.php?s=${q}`, { timeout: 4000 });
      const meal = res.data?.meals?.[0];
      if (meal?.strMealThumb) return { imageUrl: meal.strMealThumb, sourceUrl: meal.strSource || null, spoonacularId: null };
    } catch { /* ignore */ }
  }

  return { imageUrl: null, sourceUrl: null, spoonacularId: null };
}

// ─── Full recipe search for Copilot discovery ─────────────────────────────────

export interface CopilotSearchParams {
  vibe: string;                  // "quick meal" | "healthy" | "comfort food" | "adventurous"
  cuisineChoice?: string;        // "italian" | "asian" | ... | "surprise"
  mealType?: string;             // "breakfast" | "lunch" | "dinner" | "snack"
  protein?: string;              // "chicken" | "beef" | "fish" | "pork" | "vegetarian" | "sides"
  avoidedIngredients?: string[]; // from taste profile
  count?: number;                // how many to return (default 8)
  attempt?: number;              // 0 = first search, >0 = "find different" — switches to random endpoint
  // Legacy / kept for existing copilot chat path
  source?: "pantry" | "shop";
  pantryFlex?: string;
  pantryItems?: string[];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
}

const CUISINE_NORMALIZE: Record<string, { include: string; exclude?: string }> = {
  american:       { include: "american", exclude: "canadian" },
  "tex-mex":      { include: "mexican" },
  italian:        { include: "italian" },
  asian:          { include: "asian" },
  mediterranean:  { include: "mediterranean" },
  indian:         { include: "indian" },
  mexican:        { include: "mexican" },
  chinese:        { include: "chinese" },
  japanese:       { include: "japanese" },
  thai:           { include: "thai" },
  greek:          { include: "greek" },
  french:         { include: "french" },
  korean:         { include: "korean" },
  vietnamese:     { include: "vietnamese" },
  southern:       { include: "american", exclude: "canadian" },
  bbq:            { include: "american", exclude: "canadian" },
  "comfort food": { include: "american", exclude: "canadian" },
};

function mapCuisine(choice: string | undefined): string | undefined {
  const map: Record<string, string> = {
    italian:          'italian',
    asian:            'chinese,japanese,korean,thai,vietnamese',
    'tex-mex':        'mexican',
    american:         'american',
    indian:           'indian',
    mediterranean:    'mediterranean,greek,spanish',
    japanese:         'japanese',
    korean:           'korean',
    'middle-eastern': 'middle eastern',
    french:           'french',
    caribbean:        'caribbean',
    thai:             'thai',
    greek:            'greek',
  };
  if (!choice || choice === 'surprise') return undefined;
  return map[choice] ?? choice;
}

function mapVibe(vibe: string): { maxReadyTime?: number; sort?: string; minHealthScore?: number } {
  switch (vibe) {
    case 'quick meal':   return { maxReadyTime: 45, sort: 'time' };
    case 'healthy':      return { sort: 'healthiness', minHealthScore: 40 };
    case 'comfort food': return { sort: 'popularity' };
    case 'adventurous':  return { sort: 'random' };
    case 'crockpot':     return { sort: 'popularity' };
    case 'air fryer':    return { sort: 'popularity' };
    case 'meal prep':    return { sort: 'popularity' };
    default:             return { sort: 'popularity' };
  }
}

async function complexSearch(query: Record<string, any>): Promise<SpoonacularRecipe[]> {
  const res = await axios.get('https://api.spoonacular.com/recipes/complexSearch', {
    params: query,
    timeout: 8000,
  });
  return (res.data?.results || []).map((r: any) => parseSpoonacularResult(r));
}

/** Truly random results via /recipes/random — used for "find different" searches */
async function randomSearch(tags: string[], count: number, apiKey: string): Promise<SpoonacularRecipe[]> {
  const validTags = tags.filter(Boolean).join(',');
  const res = await axios.get('https://api.spoonacular.com/recipes/random', {
    params: { number: count, ...(validTags ? { tags: validTags } : {}), apiKey },
    timeout: 8000,
  });
  return (res.data?.recipes || []).map((r: any) => parseSpoonacularResult(r));
}

/**
 * Meal type → Spoonacular params.
 * Snack deliberately avoids type=snack (sparse coverage); uses query text + short time instead.
 */
function applyMealType(mealType: string | undefined, q: Record<string, any>) {
  switch (mealType) {
    case 'breakfast': q.type = 'breakfast'; break;
    case 'lunch':     q.type = 'main course'; break;
    case 'dinner':    q.type = 'main course'; break;
    case 'snack':
      q.query = q.query ? `${q.query} snack` : 'snack';
      if (!q.maxReadyTime) q.maxReadyTime = 20;
      break;
    case 'sides':     q.type = 'side dish'; break;
  }
}

/**
 * Protein choice → Spoonacular params.
 * Meats use includeIngredients. Vegetarian uses diet filter. Sides handled via mealType.
 */
function applyProtein(protein: string | undefined, q: Record<string, any>) {
  switch (protein) {
    case 'chicken':     q.includeIngredients = 'chicken'; break;
    case 'beef':        q.includeIngredients = 'beef'; break;
    case 'fish':        q.includeIngredients = 'salmon,cod,tuna,shrimp'; break;
    case 'pork':        q.includeIngredients = 'pork'; break;
    case 'vegetarian':  q.diet = 'vegetarian'; break;
    // 'sides' is handled via mealType override — see caller
  }
}

/** Build tags array for the /recipes/random endpoint */
function buildRandomTags(params: CopilotSearchParams): string[] {
  const tags: string[] = [];
  const cuisine = mapCuisine(params.cuisineChoice);
  if (cuisine) tags.push(cuisine.split(',')[0]); // first cuisine only
  if (params.mealType === 'breakfast') tags.push('breakfast');
  if (params.mealType === 'snack') tags.push('snack');
  if (params.mealType === 'sides') tags.push('side dish');
  // Map protein to a Spoonacular tag so the random endpoint respects it
  const proteinTagMap: Record<string, string> = {
    chicken: 'chicken', beef: 'beef', pork: 'pork',
    fish: 'seafood', vegetarian: 'vegetarian',
  };
  if (params.protein && proteinTagMap[params.protein]) tags.push(proteinTagMap[params.protein]);
  if (params.vibe === 'healthy') tags.push('healthy');
  return tags;
}

export async function searchRecipesForCopilot(params: CopilotSearchParams): Promise<SpoonacularRecipe[]> {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) return searchTheMealDB(params);

  const { vibe, cuisineChoice, mealType, protein, avoidedIngredients = [], count = 8, attempt = 0,
          source, pantryFlex, pantryItems = [] } = params;
  const vibeParams = mapVibe(vibe);
  const cuisine = mapCuisine(cuisineChoice);

  // Post-filter: if a specific meat protein was requested, drop recipes whose ingredient
  // list has zero mention of it. Only applied when we have enough results to afford filtering.
  const PROTEIN_KEYWORDS: Record<string, string[]> = {
    beef:    ['beef', 'steak', 'ground beef', 'brisket', 'chuck', 'sirloin', 'ribeye', 'burger'],
    chicken: ['chicken', 'poultry', 'rotisserie'],
    pork:    ['pork', 'bacon', 'ham', 'sausage', 'chorizo', 'pancetta', 'lard'],
    fish:    ['salmon', 'cod', 'tuna', 'shrimp', 'fish', 'tilapia', 'halibut', 'scallop', 'crab', 'lobster', 'prawn'],
  };
  function filterByProtein(results: SpoonacularRecipe[]): SpoonacularRecipe[] {
    if (!protein || !PROTEIN_KEYWORDS[protein]) return results;
    const kws = PROTEIN_KEYWORDS[protein];
    const filtered = results.filter(r => {
      const haystack = [
        r.title,
        ...r.ingredients.map(i => i.name),
      ].join(' ').toLowerCase();
      return kws.some(kw => haystack.includes(kw));
    });
    // Only apply if it doesn't wipe out results entirely
    return filtered.length >= 2 ? filtered : results;
  }

  // ── "Find different" path: random Spoonacular + TheMealDB + Edamam for genuine variety ──
  if (attempt > 0) {
    try {
      const [randomResults, mealDbResults, edamamResults] = await Promise.allSettled([
        randomSearch(buildRandomTags(params), count, apiKey),
        searchTheMealDB({ ...params, count: Math.ceil(count / 2) }),
        searchRecipesEdamam({ ...params, count }),
      ]);
      const random  = randomResults.status  === 'fulfilled' ? randomResults.value  : [];
      const mealDb  = mealDbResults.status  === 'fulfilled' ? mealDbResults.value  : [];
      const edamam  = edamamResults.status  === 'fulfilled' ? edamamResults.value  : [];
      // Interleave: random > mealdb > edamam (priority: instructions quality)
      const combined: SpoonacularRecipe[] = [];
      const maxLen = Math.max(random.length, mealDb.length, edamam.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < random.length)  combined.push(random[i]);
        if (i < mealDb.length)  combined.push(mealDb[i]);
        if (i < edamam.length)  combined.push(edamam[i]);
      }
      if (combined.length >= 3) return filterByProtein(combined.slice(0, count));
    } catch { /* fall through to complexSearch */ }
  }

  // ── First search: complexSearch with cascading fallbacks ──
  // Offset 0 on first search — ensures we hit the most relevant results.
  // Random offsets on retries so subsequent cascade attempts return different slices.
  const base: Record<string, any> = {
    number: count,
    offset: 0,
    addRecipeInformation: true,
    fillIngredients: false,
    apiKey,
    sort: vibeParams.sort ?? 'popularity',
  };

  if (vibeParams.maxReadyTime) base.maxReadyTime = vibeParams.maxReadyTime;
  if (vibeParams.minHealthScore) base.minHealthScore = vibeParams.minHealthScore;
  if (cuisine) {
    const normalized = CUISINE_NORMALIZE[cuisineChoice?.toLowerCase() ?? ''] ?? { include: cuisine };
    base.cuisine = normalized.include;
    if (normalized.exclude) base.excludeCuisine = normalized.exclude;
  }
  if (avoidedIngredients.length) base.excludeIngredients = avoidedIngredients.slice(0, 5).join(',');
  if (!cuisine && cuisineChoice === 'surprise') base.sort = 'random';

  // Track cooking-method keywords separately so we can drop them independently
  // from the cuisine filter during the cascade.
  let vibeQuery: string | null = null;
  if (vibe === 'crockpot')  vibeQuery = 'slow cooker crock pot braised stew';
  if (vibe === 'air fryer') vibeQuery = 'air fryer crispy roasted';
  if (vibe === 'meal prep') vibeQuery = 'meal prep batch cooking make ahead';
  if (vibeQuery) base.query = vibeQuery;

  // Sides override: treat protein=sides as a meal type
  const effectiveMealType = protein === 'sides' ? 'sides' : mealType;
  applyMealType(effectiveMealType, base);
  if (protein !== 'sides') applyProtein(protein, base);

  // Legacy pantry path
  if (source === 'pantry' && pantryItems.length > 0) {
    base.includeIngredients = pantryItems.slice(0, 10).join(',');
    base.ranking = pantryFlex === 'strict' ? 2 : 1;
    delete base.cuisine;
  }

  try {
    // Attempt 1: full params — also fetch TheMealDB + Edamam in parallel for variety
    const [spoonResults, mealDbResults, edamamResults] = await Promise.allSettled([
      complexSearch(base),
      searchTheMealDB({ ...params, count: Math.ceil(count / 2) }),
      searchRecipesEdamam({ ...params, count: Math.ceil(count / 2) }),
    ]);
    let results   = spoonResults.status  === 'fulfilled' ? spoonResults.value  : [];
    const mealDb1 = mealDbResults.status === 'fulfilled' ? mealDbResults.value : [];
    const edamam1 = edamamResults.status === 'fulfilled' ? edamamResults.value : [];

    if (results.length >= 3) {
      // Interleave: spoon > mealdb (full instructions) > edamam (no instructions)
      if (mealDb1.length > 0 || edamam1.length > 0) {
        const combined: SpoonacularRecipe[] = [];
        const maxLen = Math.max(results.length, mealDb1.length, edamam1.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < results.length)  combined.push(results[i]);
          if (i < mealDb1.length)  combined.push(mealDb1[i]);
          if (i < edamam1.length)  combined.push(edamam1[i]);
        }
        return filterByProtein(combined.slice(0, count));
      }
      return filterByProtein(results);
    }

    // TheMealDB parallel fetch has enough — use before cascading Spoonacular further
    if (mealDb1.length >= 3) return filterByProtein(mealDb1.slice(0, count));

    // Edamam parallel fetch already has enough — use it before cascading further
    if (edamam1.length >= 3) return filterByProtein(edamam1.slice(0, count));

    // Attempt 2: relax time + health constraints, keep cuisine + cooking-method query
    const relaxed: Record<string, any> = { ...base, sort: 'popularity', offset: Math.floor(Math.random() * 30) };
    delete relaxed.maxReadyTime;
    delete relaxed.minHealthScore;
    results = await complexSearch(relaxed);
    if (results.length >= 3) return filterByProtein(results);

    // Attempt 3: drop meal-type filter, keep cuisine + cooking-method query
    const noType = { ...relaxed };
    delete noType.type;
    results = await complexSearch(noType);
    if (results.length >= 3) return filterByProtein(results);

    // Attempt 4: drop protein filter, keep cuisine + cooking-method query
    const noProtein = { ...noType };
    delete noProtein.includeIngredients;
    delete noProtein.diet;
    results = await complexSearch(noProtein);
    if (results.length >= 3) return filterByProtein(results);

    // Attempt 5: drop cooking-method query — cuisine stays as a hard filter.
    // "Give me any [cuisine] recipe" is better than loosening the cuisine itself.
    const cuisineOnly = { ...noProtein };
    delete cuisineOnly.query;
    // Snack meal-type uses query text instead of type= — preserve that keyword
    if (mealType === 'snack') cuisineOnly.query = 'snack';
    results = await complexSearch(cuisineOnly);
    if (results.length >= 3) return filterByProtein(results);

    // Attempt 6: drop cuisine too — absolute last-resort Spoonacular call
    const broadest = { ...cuisineOnly };
    delete broadest.cuisine;
    results = await complexSearch(broadest);
    if (results.length > 0) {
      const edamam2 = results.length < count
        ? await searchRecipesEdamam({ ...params, count: count - results.length })
        : [];
      return filterByProtein([...results, ...edamam2].slice(0, count));
    }

    // Attempt 7: Edamam only
    const edamamFallback = await searchRecipesEdamam(params);
    if (edamamFallback.length > 0) return filterByProtein(edamamFallback);

    return searchTheMealDB(params);
  } catch (err: any) {
    console.error('Spoonacular search failed:', err?.response?.data || err.message);
    // Try Edamam before giving up
    try {
      const edamam = await searchRecipesEdamam(params);
      if (edamam.length > 0) return edamam;
    } catch { /* ignore */ }
    return searchTheMealDB(params);
  }
}

// ── Text-query–driven search (used by Find Recipes) ───────────────────────────

import type { ParsedQuery } from '../utils/parseRecipeQuery';

// Explicit exclusion lists per requested cuisine.
// Applied as Spoonacular excludeCuisine= so the API never returns off-cuisine results
// even when its own cuisine= filter is imprecise.
const CUISINE_EXCLUSIONS: Record<string, string> = {
  american:      'italian,french,indian,mexican,chinese,japanese,korean,thai,greek,mediterranean,middle eastern,vietnamese,spanish,german,nordic,eastern european,latin american,canadian',
  italian:       'american,indian,mexican,chinese,japanese,korean,thai,greek,middle eastern,vietnamese,spanish,french,german,nordic',
  'tex-mex':     'american,italian,indian,chinese,japanese,korean,thai,greek,mediterranean,middle eastern,vietnamese,french',
  mexican:       'american,italian,indian,chinese,japanese,korean,thai,greek,mediterranean,middle eastern,vietnamese,french',
  asian:         'american,italian,mexican,greek,mediterranean,middle eastern,french,spanish,german,nordic',
  mediterranean: 'american,indian,mexican,chinese,japanese,korean,thai,vietnamese,french',
  indian:        'american,italian,mexican,chinese,japanese,korean,thai,greek,mediterranean,french,vietnamese,spanish',
  japanese:      'american,italian,mexican,indian,greek,mediterranean,middle eastern,french,spanish,german',
  korean:        'american,italian,mexican,indian,greek,mediterranean,middle eastern,french,spanish,japanese',
  french:        'american,indian,mexican,chinese,japanese,korean,thai,middle eastern,vietnamese,german,nordic',
  chinese:       'american,italian,mexican,indian,greek,mediterranean,middle eastern,french,spanish,korean',
  thai:          'american,italian,mexican,indian,greek,mediterranean,middle eastern,french,spanish,korean,chinese,japanese',
  vietnamese:    'american,italian,mexican,indian,greek,mediterranean,middle eastern,french,spanish,korean,thai',
};

// Cuisines that return Spoonacular results tagged with sub-cuisines (e.g. asian → Chinese/Japanese).
// Skip exact-match post-filter for these; they're correct by construction.
const BROAD_CUISINES = new Set(['asian', 'mediterranean']);

export async function searchRecipes(
  parsed: ParsedQuery,
  options: { number?: number; offset?: number; sort?: string } = {}
): Promise<SpoonacularRecipe[]> {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  const number = options.number ?? 12;

  // TheMealDB-only path when no Spoonacular key
  if (!apiKey) {
    return searchTheMealDB({
      vibe: 'comfort food',
      cuisineChoice: parsed.cuisine ?? undefined,
      mealType: parsed.mealType ?? undefined,
      count: number,
    });
  }

  // Cuisine params that NEVER get dropped — always present when cuisine is set.
  // Use the comprehensive CUISINE_EXCLUSIONS list (covers all major off-cuisines)
  // rather than the single "exclude: canadian" from parseRecipeQuery.
  const cuisineBase: Record<string, any> = {};
  if (parsed.cuisine) {
    cuisineBase.cuisine = parsed.cuisine;
    cuisineBase.excludeCuisine =
      CUISINE_EXCLUSIONS[parsed.cuisine] ??
      parsed.excludeCuisine ??
      undefined;
  }

  function buildBase(overrides: Record<string, any> = {}): Record<string, any> {
    return {
      number,
      addRecipeInformation: true,
      fillIngredients: false,
      apiKey,
      sort: options.sort ?? (parsed.maxReadyTime ? 'time' : 'popularity'),
      ...cuisineBase,   // cuisine + excludeCuisine always present
      ...overrides,
    };
  }

  function applyMealType(q: Record<string, any>) {
    switch (parsed.mealType) {
      case 'breakfast':  q.type = 'breakfast';   break;
      case 'side dish':  q.type = 'side dish';   break;
      case 'lunch':
      case 'dinner':     q.type = 'main course'; break;
    }
  }

  function logUrl(params: Record<string, any>, level: string) {
    const p = Object.entries(params)
      .filter(([k]) => k !== 'apiKey')
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    console.log(`[searchRecipes ${level}] /recipes/complexSearch?${p}`);
  }

  // Post-process: hard filter to remove results that don't match requested cuisine.
  // Rules:
  //   - No cuisine filter active → pass everything through
  //   - Broad cuisines (asian, mediterranean) → pass everything through (sub-cuisines vary)
  //   - Specific cuisine requested:
  //       * cuisines[] is empty → DROP (unclassified ≠ American/Italian/etc.)
  //       * cuisines[] present → KEEP only if it includes the requested cuisine (case-insensitive)
  function filterByCuisine(results: SpoonacularRecipe[]): SpoonacularRecipe[] {
    if (!parsed.cuisine || BROAD_CUISINES.has(parsed.cuisine)) return results;
    return results.filter(r =>
      r.cuisines.length > 0 &&
      r.cuisines.some(c => c.toLowerCase() === parsed.cuisine!.toLowerCase())
    );
  }

  // ── Level 1: full params ───────────────────────────────────────────────────
  const l1: Record<string, any> = buildBase({ offset: 0 });
  if (parsed.searchText) l1.query = parsed.searchText;
  applyMealType(l1);
  if (parsed.maxReadyTime) l1.maxReadyTime = parsed.maxReadyTime;
  if (parsed.diet) l1.diet = parsed.diet;
  logUrl(l1, 'L1');

  try {
    // Run Spoonacular L1 + TheMealDB in parallel
    const [spoonRes, mealDbRes] = await Promise.allSettled([
      complexSearch(l1),
      parsed.cuisine
        ? searchTheMealDB({ vibe: 'comfort food', cuisineChoice: parsed.cuisine, mealType: parsed.mealType, count: Math.ceil(number / 2) })
        : Promise.resolve([] as SpoonacularRecipe[]),
    ]);
    const spoon  = filterByCuisine(spoonRes.status  === 'fulfilled' ? spoonRes.value  : []);
    const mealDb = mealDbRes.status === 'fulfilled' ? mealDbRes.value : [];

    if (spoon.length >= 3) {
      // Interleave only TheMealDB results that match cuisine
      if (mealDb.length > 0) {
        const combined: SpoonacularRecipe[] = [];
        const max = Math.max(spoon.length, mealDb.length);
        for (let i = 0; i < max; i++) {
          if (i < spoon.length)  combined.push(spoon[i]);
          if (i < mealDb.length) combined.push(mealDb[i]);
        }
        return combined.slice(0, number);
      }
      return spoon;
    }
    if (mealDb.length >= 3) return mealDb.slice(0, number);

    // ── Level 2: drop searchText, keep everything else ─────────────────────
    if (parsed.searchText) {
      const l2 = buildBase({ offset: Math.floor(Math.random() * 20), sort: 'popularity' });
      applyMealType(l2);
      if (parsed.maxReadyTime) l2.maxReadyTime = parsed.maxReadyTime;
      if (parsed.diet) l2.diet = parsed.diet;
      // no query= here — searchText dropped
      logUrl(l2, 'L2');
      const r2 = filterByCuisine(await complexSearch(l2));
      if (r2.length >= 3) return r2;
    }

    // ── Level 3: drop maxReadyTime, keep cuisine + mealType + diet ─────────
    if (parsed.maxReadyTime) {
      const l3 = buildBase({ offset: Math.floor(Math.random() * 20), sort: 'popularity' });
      applyMealType(l3);
      if (parsed.diet) l3.diet = parsed.diet;
      logUrl(l3, 'L3');
      const r3 = filterByCuisine(await complexSearch(l3));
      if (r3.length >= 3) return r3;
    }

    // ── Level 4: drop mealType (and diet), keep cuisine + excludeCuisine only
    {
      const l4 = buildBase({ offset: Math.floor(Math.random() * 30), sort: 'popularity' });
      logUrl(l4, 'L4');
      const r4 = filterByCuisine(await complexSearch(l4));
      if (r4.length > 0) return r4;
    }

    // ── Cuisine-filtered TheMealDB as last resort (matches cuisine) ─────────
    if (mealDb.length > 0) return mealDb;
    if (parsed.cuisine) {
      const fallbackDb = await searchTheMealDB({ vibe: 'comfort food', cuisineChoice: parsed.cuisine, count: number });
      if (fallbackDb.length > 0) return fallbackDb;
    }

    // Return whatever we have — never supplement with off-cuisine results
    return [...spoon, ...mealDb].slice(0, number);

  } catch (err: any) {
    console.error('[searchRecipes] Error:', err?.message);
    if (parsed.cuisine) {
      return searchTheMealDB({ vibe: 'comfort food', cuisineChoice: parsed.cuisine, mealType: parsed.mealType, count: number });
    }
    return [];
  }
}

// ── Cuisine-specific emoji fallback ───────────────────────────────────────────
export const CUISINE_EMOJI: Record<string, string> = {
  american: '🍔', italian: '🍝', mexican: '🌮', 'tex-mex': '🌮',
  asian: '🍜', chinese: '🍜', japanese: '🍣', korean: '🌶️', thai: '🍛',
  indian: '🍛', mediterranean: '🥗', french: '🥐', default: '🍽️',
};

function parseSpoonacularResult(r: any): SpoonacularRecipe {
  // Image: use 636x393 for good quality
  const imageUrl = r.image
    ? `https://img.spoonacular.com/recipes/${r.id}-636x393.jpg`
    : '';

  // Ingredients from extendedIngredients
  const ingredients = (r.extendedIngredients || []).map((i: any) => ({
    name: i.nameClean || i.name,
    amount: i.amount,
    unit: i.unit,
    original: i.original,
  }));

  // Instructions: flatten analyzed instructions into step strings
  const instructions: string[] = [];
  for (const section of (r.analyzedInstructions || [])) {
    for (const step of (section.steps || [])) {
      if (step.step) instructions.push(step.step);
    }
  }

  return {
    id: r.id,
    title: r.title,
    imageUrl,
    sourceUrl: r.sourceUrl || '',
    readyInMinutes: r.readyInMinutes || 30,
    servings: r.servings || 2,
    summary: stripHtml(r.summary || '').slice(0, 200),
    cuisines: r.cuisines || [],
    dishTypes: r.dishTypes || [],
    diets: r.diets || [],
    ingredients,
    instructions,
  };
}

// ── TheMealDB filter maps ──────────────────────────────────────────────────────
const MEALDB_AREA_MAP: Record<string, string[]> = {
  italian:          ['Italian'],
  asian:            ['Chinese', 'Japanese', 'Korean', 'Thai', 'Vietnamese'],
  'tex-mex':        ['Mexican'],
  american:         ['American'],
  indian:           ['Indian'],
  mediterranean:    ['Greek', 'Spanish', 'French', 'Moroccan'],
  japanese:         ['Japanese'],
  korean:           ['Korean'],
  'middle-eastern': ['Moroccan', 'Turkish'],
  french:           ['French'],
  caribbean:        ['Jamaican'],
  thai:             ['Thai'],
  greek:            ['Greek'],
};

const MEALDB_CATEGORY_MAP: Record<string, string> = {
  chicken: 'Chicken', beef: 'Beef', fish: 'Seafood',
  pork: 'Pork', vegetarian: 'Vegetarian',
};

const MEALDB_VIBE_CATEGORY: Record<string, string> = {
  'comfort food': 'Pasta', healthy: 'Vegetarian',
  'quick meal': 'Chicken', adventurous: 'Seafood',
};

const MEALDB_ALL_AREAS = [
  'American','British','Canadian','Chinese','Croatian','Dutch','Egyptian',
  'Filipino','French','Greek','Indian','Irish','Italian','Jamaican','Japanese',
  'Kenyan','Malaysian','Mexican','Moroccan','Polish','Portuguese','Russian',
  'Spanish','Thai','Tunisian','Turkish','Ukrainian','Vietnamese',
];

function convertMealDBMeal(m: any): SpoonacularRecipe {
  return {
    id: parseInt(m.idMeal),
    title: m.strMeal,
    imageUrl: m.strMealThumb || '',
    sourceUrl: m.strSource || `https://www.themealdb.com/meal/${m.idMeal}`,
    readyInMinutes: 30,
    servings: 4,
    summary: m.strInstructions ? m.strInstructions.slice(0, 200) + '...' : '',
    cuisines: [m.strArea?.toLowerCase() || 'other'],
    dishTypes: [m.strCategory?.toLowerCase() || 'dinner'],
    diets: [],
    ingredients: extractTheMealDBIngredients(m),
    instructions: m.strInstructions
      ? m.strInstructions.split(/\r?\n/).filter((s: string) => s.trim().length > 10)
      : [],
  };
}

async function searchTheMealDB(params: CopilotSearchParams): Promise<SpoonacularRecipe[]> {
  const count = params.count || 6;

  const areas = params.cuisineChoice === 'surprise'
    ? [MEALDB_ALL_AREAS[Math.floor(Math.random() * MEALDB_ALL_AREAS.length)]]
    : (MEALDB_AREA_MAP[params.cuisineChoice ?? ''] ?? null);

  const category = params.protein
    ? MEALDB_CATEGORY_MAP[params.protein]
    : MEALDB_VIBE_CATEGORY[params.vibe];

  type Stub = { idMeal: string; strMeal: string; strMealThumb: string };
  let candidates: Stub[] = [];

  try {
    if (areas) {
      const fetches = await Promise.allSettled(
        areas.map(a =>
          axios.get(`https://www.themealdb.com/api/json/v1/1/filter.php?a=${a}`, { timeout: 5000 })
        )
      );
      for (const r of fetches) {
        if (r.status === 'fulfilled') candidates.push(...(r.value.data?.meals || []));
      }
    }

    if (candidates.length === 0 && category) {
      const res = await axios.get(
        `https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(category)}`,
        { timeout: 5000 }
      );
      candidates = res.data?.meals || [];
    }

    if (candidates.length === 0) {
      // Keyword fallback
      const queryMap: Record<string, string> = {
        italian: 'pasta', asian: 'stir fry', 'tex-mex': 'tacos', american: 'chicken',
        indian: 'curry', healthy: 'salad', 'quick meal': 'eggs', 'comfort food': 'soup',
      };
      const q = queryMap[params.cuisineChoice || params.vibe] || 'chicken';
      const res = await axios.get(
        `https://www.themealdb.com/api/json/v1/1/search.php?s=${q}`, { timeout: 5000 }
      );
      return (res.data?.meals || []).slice(0, count).map(convertMealDBMeal);
    }

    // Shuffle for variety, pick `count` IDs, then fetch full details in parallel
    const shuffled = [...candidates].sort(() => Math.random() - 0.5).slice(0, count);
    const details = await Promise.allSettled(
      shuffled.map(m =>
        axios.get(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${m.idMeal}`, { timeout: 5000 })
      )
    );

    const results: SpoonacularRecipe[] = [];
    for (const r of details) {
      if (r.status === 'fulfilled') {
        const meal = r.value.data?.meals?.[0];
        if (meal) results.push(convertMealDBMeal(meal));
      }
    }
    return results;

  } catch {
    return [];
  }
}

function extractTheMealDBIngredients(meal: any): SpoonacularRecipe['ingredients'] {
  const result = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (name && name.trim()) {
      result.push({ name: name.trim(), amount: 1, unit: measure?.trim() || '', original: `${measure?.trim() || ''} ${name.trim()}`.trim() });
    }
  }
  return result;
}
