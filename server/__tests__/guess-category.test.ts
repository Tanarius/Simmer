/**
 * guessCategory unit tests — pure function, no mocks, no HTTP.
 *
 * CLAUDE.md rule: "always re-run guessCategory(name) at shopping list generation
 * time — never trust stored ing.category". These tests lock in the correct behaviour
 * and catch any regression that would silently corrupt the shopping list.
 *
 * Critical ordering rule (from routes.ts):
 *   protein → dairy → frozen → bakery → grains → condiments → pantry → produce
 * Pantry must be checked BEFORE produce so "garlic powder" → pantry, not produce.
 */

import { describe, it, expect } from "vitest";
import { guessCategory } from "../utils/categorization";

// ─── Table-driven tests ───────────────────────────────────────────────────────

const cases: Array<[string, string, string]> = [
  // ── Protein ──────────────────────────────────────────────────────────────
  ["chicken breast",                       "protein", "chicken"],
  ["boneless skinless chicken thighs",     "protein", "chicken with modifiers"],
  ["ground beef",                          "protein", "ground beef"],
  ["ground turkey",                        "protein", "ground turkey"],
  ["salmon fillet",                        "protein", "fish"],
  ["shrimp peeled and deveined",           "protein", "shrimp"],
  ["bacon strips",                         "protein", "bacon"],
  ["pork shoulder",                        "protein", "pork"],
  ["beef broth",                           "protein", "broth matches protein"],
  ["chicken stock",                        "protein", "stock matches protein"],

  // ── Dairy ────────────────────────────────────────────────────────────────
  ["shredded cheddar cheese",              "dairy",   "cheese"],
  ["whole milk",                           "dairy",   "milk"],
  ["heavy cream",                          "dairy",   "cream"],
  ["unsalted butter",                      "dairy",   "butter"],
  ["plain Greek yogurt",                   "dairy",   "yogurt"],
  ["large eggs",                           "dairy",   "eggs"],
  ["sour cream",                           "dairy",   "sour cream"],

  // ── Frozen ───────────────────────────────────────────────────────────────
  ["frozen peas",                          "frozen",  "frozen keyword"],
  ["frozen corn",                          "frozen",  "frozen beats produce"],
  ["frozen spinach",                       "frozen",  "frozen beats produce"],

  // ── Bakery ───────────────────────────────────────────────────────────────
  ["sandwich bread",                       "bakery",  "bread"],
  ["hamburger buns",                       "bakery",  "buns"],
  ["flour tortillas",                      "bakery",  "tortillas"],
  ["naan bread",                           "bakery",  "naan"],
  ["pita bread",                           "bakery",  "pita"],

  // ── Grains ───────────────────────────────────────────────────────────────
  ["long grain white rice",               "grains",  "rice with word boundary"],
  ["penne pasta",                          "grains",  "pasta"],
  ["egg noodles",                          "grains",  "noodle"],
  ["quinoa",                               "grains",  "quinoa"],
  ["all-purpose flour",                    "grains",  "flour"],
  ["cornstarch",                           "grains",  "cornstarch"],
  ["breadcrumbs",                          "grains",  "breadcrumb"],

  // ── Condiments ───────────────────────────────────────────────────────────
  ["tomato sauce",                         "condiments", "sauce"],
  ["soy sauce",                            "condiments", "soy sauce"],
  ["Dijon mustard",                        "condiments", "mustard"],
  ["apple cider vinegar",                  "condiments", "vinegar"],
  ["mayonnaise",                           "condiments", "mayo"],
  ["sriracha",                             "condiments", "sriracha"],
  ["ranch dressing",                       "condiments", "dressing"],
  ["salsa verde",                          "condiments", "salsa"],
  ["tomato paste",                         "condiments", "paste"],
  ["fish sauce",                           "condiments", "fish sauce"],
  ["hoisin sauce",                         "condiments", "hoisin"],
  ["worcestershire sauce",                 "condiments", "worcestershire"],
  ["oyster sauce",                         "condiments", "oyster sauce"],

  // ── Pantry ───────────────────────────────────────────────────────────────
  ["garlic powder",                        "pantry",  "CRITICAL: powder → pantry, not produce"],
  ["onion powder",                         "pantry",  "CRITICAL: powder → pantry, not produce"],
  ["dried oregano",                        "pantry",  "dried → pantry"],
  ["red pepper flakes",                    "pantry",  "flakes → pantry"],
  ["salt",                                 "pantry",  "salt"],
  ["black pepper",                         "pantry",  "pepper as spice (word boundary)"],
  ["paprika",                              "pantry",  "paprika"],
  ["cumin",                                "pantry",  "cumin"],
  ["chili powder",                         "pantry",  "chili powder"],
  ["turmeric",                             "pantry",  "turmeric"],
  ["cinnamon",                             "pantry",  "cinnamon"],
  ["vanilla extract",                      "pantry",  "extract"],
  ["baking soda",                          "pantry",  "baking soda"],
  ["baking powder",                        "pantry",  "baking powder"],
  ["granulated sugar",                     "pantry",  "sugar"],
  ["brown sugar",                          "pantry",  "brown sugar"],
  ["honey",                                "pantry",  "honey"],
  ["olive oil",                            "pantry",  "olive oil"],
  ["vegetable oil",                        "pantry",  "vegetable oil"],
  ["coconut oil",                          "pantry",  "coconut oil"],
  ["canned diced tomatoes",                "pantry",  "canned → pantry"],
  ["can of black beans",                   "pantry",  "can → pantry"],
  ["jarred roasted red peppers",           "pantry",  "jarred → pantry"],
  ["chicken bouillon cube",                "pantry",  "bouillon cube → pantry (not protein)"],

  // ── Produce ──────────────────────────────────────────────────────────────
  ["yellow onion",                         "produce", "onion (word boundary)"],
  ["fresh garlic cloves",                  "produce", "garlic clove (not garlic powder)"],
  ["red bell pepper",                      "produce", "bell pepper"],
  ["roma tomatoes",                        "produce", "tomato"],
  ["romaine lettuce",                      "produce", "lettuce"],
  ["avocado",                              "produce", "avocado"],
  ["lime",                                 "produce", "lime"],
  ["lemon",                                "produce", "lemon"],
  ["fresh cilantro",                       "produce", "cilantro"],
  ["fresh basil",                          "produce", "basil"],
  ["broccoli florets",                     "produce", "broccoli"],
  ["carrots",                              "produce", "carrot"],
  ["celery stalks",                        "produce", "celery"],
  ["russet potatoes",                      "produce", "potato"],
  ["cremini mushrooms",                    "produce", "mushroom"],
  ["baby spinach",                         "produce", "spinach"],
  ["zucchini",                             "produce", "zucchini"],
  ["cucumber",                             "produce", "cucumber"],
  ["green onions",                         "produce", "green onion"],
  ["scallions",                            "produce", "scallion"],
  ["sweet potato",                         "produce", "sweet potato"],

  // ── Default fallback ─────────────────────────────────────────────────────
  ["something completely unknown",         "pantry",  "unknown → pantry default"],
  ["tofu",                                 "pantry",  "tofu → pantry default"],
  ["tahini",                               "pantry",  "tahini → pantry default"],
];

describe("guessCategory", () => {
  cases.forEach(([input, expected, description]) => {
    it(`"${input}" → ${expected} (${description})`, () => {
      expect(guessCategory(input)).toBe(expected);
    });
  });
});

// ─── Ordering invariants ──────────────────────────────────────────────────────

describe("guessCategory — ordering invariants", () => {
  it("pantry-before-produce: 'garlic powder' is pantry, not produce", () => {
    // This is the canonical example from CLAUDE.md.
    // If the order ever flips, shopping lists will mis-categorise spices.
    expect(guessCategory("garlic powder")).toBe("pantry");
    expect(guessCategory("garlic cloves")).toBe("produce");
  });

  it("pantry-before-produce: 'onion powder' is pantry, not produce", () => {
    expect(guessCategory("onion powder")).toBe("pantry");
    expect(guessCategory("yellow onion")).toBe("produce");
  });

  it("frozen beats produce: 'frozen corn' is frozen, not produce", () => {
    expect(guessCategory("frozen corn")).toBe("frozen");
    expect(guessCategory("corn on the cob")).toBe("produce");
  });

  it("protein beats dairy: 'beef broth' is protein, not pantry", () => {
    // broth appears in both protein and pantry patterns;
    // protein is checked first so it wins
    expect(guessCategory("beef broth")).toBe("protein");
  });

  it("condiments beats pantry: 'tomato paste' is condiments, not pantry", () => {
    expect(guessCategory("tomato paste")).toBe("condiments");
  });
});
