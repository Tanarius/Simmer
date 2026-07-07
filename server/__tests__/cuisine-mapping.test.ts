/**
 * Cuisine-filter regression tests.
 *
 * Locks in the fix for the "Mexican filter returns Italian dishes" bug.
 *
 * Root cause: a cuisine value reached TheMealDB lookup that had no key in
 * MEALDB_AREA_MAP. The missing-key path silently fell through to the
 * vibe-category fallback (→ 'Pasta' → Italian dishes), so a Mexican request
 * surfaced Italian recipes. See the comment above MEALDB_AREA_MAP in
 * server/services/spoonacular.ts.
 *
 * Two layers of protection:
 *   (a) Map-integrity — every cuisine value that cuisineChipToQuery /
 *       parseRecipeQuery can emit as parsed.cuisine MUST have a MEALDB_AREA_MAP
 *       key. If anyone adds a new cuisine later without a map key, this fails.
 *   (b) filterByCuisine correctness — the post-search hard filter keeps only
 *       on-cuisine results, drops off-cuisine, and passes through where designed
 *       (broad cuisines + no-cuisine).
 *
 * Pure functions — no mocks, no HTTP, no DB.
 */

import { describe, it, expect } from "vitest";
import {
  CUISINE_CHIP_MAP,
  CUISINE_RULES,
  cuisineChipToQuery,
  parseRecipeQuery,
} from "../utils/parseRecipeQuery";
import {
  MEALDB_AREA_MAP,
  filterByCuisine,
  type SpoonacularRecipe,
} from "../services/spoonacular";

// ─── Source of the UI chip values ─────────────────────────────────────────────
// Mirrors CUISINE_CHIPS in client/src/components/FindRecipesPanel.tsx.
// `null` (the "All" chip) and "surprise" are intentionally excluded: ai.ts skips
// cuisineChipToQuery for both (`if (cuisineChoice && cuisineChoice !== 'surprise')`),
// and "surprise" is routed by its own random-area branch in searchTheMealDB — so
// neither ever becomes parsed.cuisine for a MEALDB_AREA_MAP lookup.
const CUISINE_CHIP_VALUES = [
  "american",
  "italian",
  "tex-mex",
  "asian",
  "mediterranean",
  "indian",
  "japanese",
  "korean",
  "french",
];

const MAP_KEYS = new Set(Object.keys(MEALDB_AREA_MAP));

// ─── (a) Map-integrity tests — the ones that would have caught the bug ─────────

describe("MEALDB_AREA_MAP integrity", () => {
  it("has a map key for every cuisine the UI chips can emit", () => {
    // Drives the real chip values through cuisineChipToQuery exactly as ai.ts does,
    // then asserts the resulting parsed.cuisine has a MEALDB_AREA_MAP entry.
    // This is the original bug: a chip whose cuisine had no map key fell through
    // to the Italian-returning fallback.
    for (const chip of CUISINE_CHIP_VALUES) {
      const { cuisine } = cuisineChipToQuery(chip);
      expect(cuisine, `chip "${chip}" → cuisine "${cuisine}"`).toBeDefined();
      expect(
        MAP_KEYS.has(cuisine!),
        `chip "${chip}" maps to cuisine "${cuisine}" which is missing from MEALDB_AREA_MAP`,
      ).toBe(true);
    }
  });

  it("has a map key for every cuisine in CUISINE_CHIP_MAP", () => {
    // Defensive: covers every entry in the chip map, including ones not yet
    // surfaced in the UI (e.g. middle-eastern), so adding a chip mapping without
    // a corresponding area map entry fails here too.
    for (const [chip, { cuisine }] of Object.entries(CUISINE_CHIP_MAP)) {
      expect(
        MAP_KEYS.has(cuisine),
        `CUISINE_CHIP_MAP["${chip}"].cuisine = "${cuisine}" is missing from MEALDB_AREA_MAP`,
      ).toBe(true);
    }
  });

  it("has a map key for every cuisine parseRecipeQuery can emit", () => {
    // Enumerate the parser's possible cuisine outputs straight from CUISINE_RULES
    // so a newly-added text rule without a map key is caught automatically.
    const parserCuisines = new Set(CUISINE_RULES.map(([, cuisine]) => cuisine));
    for (const cuisine of parserCuisines) {
      expect(
        MAP_KEYS.has(cuisine),
        `parseRecipeQuery can emit "${cuisine}" but it is missing from MEALDB_AREA_MAP`,
      ).toBe(true);
    }
  });

  it("routes the tex-mex chip and 'mexican' text to the Mexican area (the exact bug)", () => {
    // Concrete reproduction: a Mexican request must resolve to ['Mexican'], never
    // to the Italian-producing fallback.
    const chipCuisine = cuisineChipToQuery("tex-mex").cuisine!;
    expect(chipCuisine).toBe("mexican");
    expect(MEALDB_AREA_MAP[chipCuisine]).toEqual(["Mexican"]);

    const parsedCuisine = parseRecipeQuery("mexican tacos").cuisine!;
    expect(parsedCuisine).toBe("mexican");
    expect(MEALDB_AREA_MAP[parsedCuisine]).toEqual(["Mexican"]);
  });
});

// ─── (b) filterByCuisine correctness ──────────────────────────────────────────

function mk(title: string, cuisines: string[]): SpoonacularRecipe {
  return {
    id: title.length,
    title,
    imageUrl: "",
    sourceUrl: "",
    readyInMinutes: 30,
    servings: 2,
    summary: "",
    cuisines,
    dishTypes: [],
    diets: [],
    ingredients: [],
    instructions: [],
  };
}

describe("filterByCuisine", () => {
  const mexican1 = mk("Tacos", ["mexican"]);
  const mexican2 = mk("Enchiladas", ["mexican"]);
  const italian1 = mk("Lasagna", ["italian"]);
  const italian2 = mk("Carbonara", ["italian"]);

  it("keeps only matching-cuisine results and drops off-cuisine ones", () => {
    const mixed = [mexican1, italian1, mexican2, italian2];
    const result = filterByCuisine(mixed, "mexican");
    expect(result).toEqual([mexican1, mexican2]);
    expect(result.every(r => r.cuisines.includes("mexican"))).toBe(true);
    expect(result.some(r => r.cuisines.includes("italian"))).toBe(false);
  });

  it("matches cuisine case-insensitively", () => {
    const mixed = [mk("Tacos", ["Mexican"]), mk("Lasagna", ["Italian"])];
    const result = filterByCuisine(mixed, "mexican");
    expect(result.map(r => r.title)).toEqual(["Tacos"]);
  });

  it("drops results with an empty cuisines[] for a specific cuisine", () => {
    // Unclassified recipes (cuisines: []) are NOT assumed to match — they're dropped.
    const mixed = [mexican1, mk("Mystery dish", [])];
    const result = filterByCuisine(mixed, "mexican");
    expect(result).toEqual([mexican1]);
  });

  it("keeps a result tagged with multiple cuisines if one of them matches", () => {
    const fusion = mk("Tex-Mex pasta", ["italian", "mexican"]);
    const result = filterByCuisine([fusion, italian1], "mexican");
    expect(result).toEqual([fusion]);
  });

  it("passes everything through for broad cuisines (asian)", () => {
    // asian ∈ BROAD_CUISINES: Spoonacular tags sub-cuisines, so no exact filter.
    const mixed = [
      mk("Pad Thai", ["thai"]),
      mk("Ramen", ["japanese"]),
      mk("Lasagna", ["italian"]),
    ];
    expect(filterByCuisine(mixed, "asian")).toEqual(mixed);
  });

  it("passes everything through for the other broad cuisine (mediterranean)", () => {
    const mixed = [mk("Gyro", ["greek"]), mk("Paella", ["spanish"])];
    expect(filterByCuisine(mixed, "mediterranean")).toEqual(mixed);
  });

  it("passes everything through when no cuisine is requested", () => {
    const mixed = [mexican1, italian1];
    expect(filterByCuisine(mixed, undefined)).toEqual(mixed);
    expect(filterByCuisine(mixed)).toEqual(mixed);
    expect(filterByCuisine(mixed, "")).toEqual(mixed);
  });
});
