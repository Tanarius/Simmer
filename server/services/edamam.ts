import axios from "axios";
import type { SpoonacularRecipe, CopilotSearchParams } from "./spoonacular";

// ─── Edamam API mapping ────────────────────────────────────────────────────────

const CUISINE_MAP: Record<string, string> = {
  italian:          "italian",
  asian:            "asian",
  "tex-mex":        "mexican",
  american:         "american",
  indian:           "indian",
  mediterranean:    "mediterranean",
  japanese:         "japanese",
  korean:           "korean",
  "middle-eastern": "middle eastern",
  french:           "french",
  caribbean:        "caribbean",
  thai:             "south east asian",
  greek:            "greek",
  chinese:          "chinese",
};

const MEAL_MAP: Record<string, string> = {
  breakfast: "breakfast",
  lunch:     "lunch",
  dinner:    "dinner",
  snack:     "snack",
};

function buildQuery(params: CopilotSearchParams): string {
  const parts: string[] = [];

  if (params.protein && params.protein !== "sides" && params.protein !== "vegetarian") {
    parts.push(params.protein);
  }
  if (params.vibe === "comfort food") parts.push("homemade");
  if (params.vibe === "adventurous") parts.push("exotic");
  if (params.mealType === "sides") parts.push("side dish");
  if (!parts.length && params.cuisineChoice && params.cuisineChoice !== "surprise") {
    parts.push(params.cuisineChoice.replace("-", " "));
  }
  if (!parts.length) parts.push("dinner");
  return parts.join(" ");
}

function parseEdamamRecipe(hit: any): SpoonacularRecipe {
  const r = hit.recipe;
  const id = parseInt(r.uri.split("_")[1] ?? "0", 10);

  // Parse ingredients
  const ingredients = (r.ingredients || []).map((i: any) => ({
    name: i.food || i.text,
    amount: Math.round((i.weight || 100) / 10) / 10,
    unit: i.measure === "<unit>" ? "" : (i.measure || ""),
    original: i.text,
  }));

  // Edamam doesn't expose step-by-step instructions in their API response.
  // Insert a single step linking to the source so saved recipes aren't blank.
  const instructions: string[] = r.url
    ? [`Full cooking instructions available at the source link above.`]
    : [];

  return {
    id,
    title: r.label,
    imageUrl: r.image ? r.image.replace(/\/100x100\//, "/636x393/") : "",
    sourceUrl: r.url || r.shareAs || "",
    readyInMinutes: r.totalTime && r.totalTime > 0 ? Math.round(r.totalTime) : 35,
    servings: Math.round(r.yield || 2),
    summary: `${r.cuisineType?.join(", ") || ""} · ${r.mealType?.join(", ") || ""}`.replace(/^ · | · $/, ""),
    cuisines: r.cuisineType || [],
    dishTypes: r.mealType || [],
    diets: r.dietLabels || [],
    ingredients,
    instructions,
    _source: "edamam",
  } as any;
}

export async function searchRecipesEdamam(
  params: CopilotSearchParams,
): Promise<SpoonacularRecipe[]> {
  const appId  = process.env.EDAMAM_APP_ID;
  const appKey = process.env.EDAMAM_APP_KEY;
  if (!appId || !appKey) return [];

  const q = buildQuery(params);
  const cuisine = params.cuisineChoice ? CUISINE_MAP[params.cuisineChoice] : undefined;
  const mealType = params.mealType ? MEAL_MAP[params.mealType] : undefined;

  const query: Record<string, any> = {
    type:    "public",
    q,
    app_id:  appId,
    app_key: appKey,
    to:      params.count ?? 8,
    random:  params.attempt && params.attempt > 0 ? "true" : undefined,
  };
  if (cuisine)   query.cuisineType = cuisine;
  if (mealType)  query.mealType    = mealType;
  if (params.vibe === "quick meal") query["time"] = "1-40";
  if (params.protein === "vegetarian") query.health = "vegetarian";

  // Exclude disliked ingredients (max 3 — Edamam health= param can't exclude arbitrary ingredients
  // but we can filter client-side after fetch)
  const avoided = params.avoidedIngredients || [];

  try {
    const res = await axios.get("https://api.edamam.com/api/recipes/v2", {
      params: query,
      timeout: 8000,
    });

    const hits: any[] = res.data?.hits || [];
    const recipes = hits.map(parseEdamamRecipe);

    // Client-side exclusion for avoided ingredients
    if (avoided.length === 0) return recipes;
    return recipes.filter(recipe =>
      !recipe.ingredients.some(ing =>
        avoided.some(a => ing.name.toLowerCase().includes(a.toLowerCase()))
      )
    );
  } catch (err: any) {
    console.error("Edamam search failed:", err?.response?.data || err?.message);
    return [];
  }
}
