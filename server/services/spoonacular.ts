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

export async function searchRecipeImage(recipeName: string): Promise<RecipeImageResult> {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (apiKey) {
    try {
      const res = await axios.get("https://api.spoonacular.com/recipes/complexSearch", {
        params: { query: recipeName, number: 1, addRecipeInformation: true, apiKey },
        timeout: 5000,
      });
      const r = res.data?.results?.[0];
      if (r) {
        return {
          imageUrl: r.image ? r.image.replace(/-\d+x\d+\./, "-636x393.") : null,
          sourceUrl: r.sourceUrl || null,
          spoonacularId: r.id || null,
        };
      }
    } catch { /* fall through */ }
  }

  // Free fallback: TheMealDB
  try {
    const q = encodeURIComponent(recipeName.split(" ").slice(0, 3).join(" "));
    const res = await axios.get(`https://www.themealdb.com/api/json/v1/1/search.php?s=${q}`, { timeout: 4000 });
    const meal = res.data?.meals?.[0];
    if (meal) return { imageUrl: meal.strMealThumb || null, sourceUrl: meal.strSource || null, spoonacularId: null };
  } catch { /* ignore */ }

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

  // ── "Find different" path: mix Edamam + random Spoonacular for genuine variety ──
  if (attempt > 0) {
    try {
      // Request full count from each source so one can cover if the other returns fewer
      const [edamamResults, randomResults] = await Promise.allSettled([
        searchRecipesEdamam({ ...params, count }),
        randomSearch(buildRandomTags(params), count, apiKey),
      ]);
      const edamam = edamamResults.status === 'fulfilled' ? edamamResults.value : [];
      const random = randomResults.status === 'fulfilled' ? randomResults.value : [];
      // Interleave: edamam[0], random[0], edamam[1], random[1], ...
      const combined: SpoonacularRecipe[] = [];
      const maxLen = Math.max(edamam.length, random.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < edamam.length) combined.push(edamam[i]);
        if (i < random.length) combined.push(random[i]);
      }
      if (combined.length >= 3) return filterByProtein(combined.slice(0, count));
    } catch { /* fall through to complexSearch */ }
  }

  // ── First search: complexSearch with cascading fallbacks ──
  // Random offset ensures a different slice of results each call (Spoonacular returns
  // the same top-N by popularity without it)
  const base: Record<string, any> = {
    number: count,
    offset: Math.floor(Math.random() * 20),
    addRecipeInformation: true,
    fillIngredients: false,
    apiKey,
    sort: vibeParams.sort ?? 'popularity',
  };

  if (vibeParams.maxReadyTime) base.maxReadyTime = vibeParams.maxReadyTime;
  if (vibeParams.minHealthScore) base.minHealthScore = vibeParams.minHealthScore;
  if (cuisine) base.cuisine = cuisine;
  if (avoidedIngredients.length) base.excludeIngredients = avoidedIngredients.slice(0, 5).join(',');
  if (!cuisine && cuisineChoice === 'surprise') base.sort = 'random';

  // Inject cooking-method keywords for crockpot/air-fryer/meal-prep vibes
  if (params.vibe === 'crockpot')  base.query = ((base.query || '') + ' slow cooker crock pot').trim();
  if (params.vibe === 'air fryer') base.query = ((base.query || '') + ' air fryer').trim();
  if (params.vibe === 'meal prep') base.query = ((base.query || '') + ' meal prep batch cooking').trim();

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
    // Attempt 1: full params — also fetch Edamam in parallel for variety
    const [spoonResults, edamamResults] = await Promise.allSettled([
      complexSearch(base),
      searchRecipesEdamam({ ...params, count: Math.ceil(count / 2) }),
    ]);
    let results = spoonResults.status === 'fulfilled' ? spoonResults.value : [];
    const edamam = edamamResults.status === 'fulfilled' ? edamamResults.value : [];

    if (results.length >= 3) {
      // Enrich with Edamam — interleave for variety, cap at count
      if (edamam.length > 0) {
        const combined: SpoonacularRecipe[] = [];
        const maxLen = Math.max(results.length, edamam.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < results.length) combined.push(results[i]);
          if (i < edamam.length) combined.push(edamam[i]);
        }
        return filterByProtein(combined.slice(0, count));
      }
      return filterByProtein(results);
    }

    // Attempt 2: relax time + health, keep cuisine + protein hint
    const relaxed = { ...base };
    delete relaxed.maxReadyTime;
    delete relaxed.minHealthScore;
    relaxed.sort = 'popularity';
    results = await complexSearch(relaxed);
    if (results.length >= 3) return results;

    // Attempt 3: drop type filter (too restrictive for snack/sides)
    const noType = { ...relaxed };
    delete noType.type;
    results = await complexSearch(noType);
    if (results.length >= 3) return results;

    // Attempt 4: drop protein filter, keep cuisine
    const noProtein = { ...noType };
    delete noProtein.includeIngredients;
    delete noProtein.diet;
    results = await complexSearch(noProtein);
    if (results.length >= 3) return results;

    // Attempt 5: drop cuisine — use as query keyword
    const broadest = { ...noProtein };
    delete broadest.cuisine;
    if (cuisine) {
      const kw = cuisine.split(',')[0];
      broadest.query = broadest.query ? `${broadest.query} ${kw}` : kw;
    }
    results = await complexSearch(broadest);
    if (results.length > 0) {
      // Top up with Edamam if we got fewer than count
      if (results.length < count) {
        const edamam = await searchRecipesEdamam({ ...params, count: count - results.length });
        return [...results, ...edamam].slice(0, count);
      }
      return results;
    }

    // Attempt 6: Edamam
    const edamamFallback = await searchRecipesEdamam(params);
    if (edamamFallback.length > 0) return edamamFallback;

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
  american:         ['American', 'Canadian'],
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
