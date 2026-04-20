/**
 * buildShoppingList unit tests — pure function, no mocks, no HTTP.
 *
 * Tests the core shopping list algorithm:
 *  - Ingredient deduplication (case-insensitive key)
 *  - Amount aggregation across recipes
 *  - Category derivation via guessCategory (never trusts stored category)
 *  - Staple flagging
 *  - Category grouping and CATEGORY_ORDER sort
 *  - Alphabetical sort within each category
 */

import { describe, it, expect } from "vitest";
import { buildShoppingList, CATEGORY_ORDER } from "../utils/shoppingList";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ing(name: string, amount: number | string = 1, unit = "cup") {
  return { name, amount, unit };
}

// ─── Deduplication ────────────────────────────────────────────────────────────

describe("buildShoppingList — deduplication", () => {
  it("same ingredient name (case-insensitive) merges into one entry", () => {
    const result = buildShoppingList(
      [ing("Olive Oil", 2), ing("olive oil", 1)],
      new Set(),
    );
    expect(result.totalItems).toBe(1);
  });

  it("amounts from duplicate entries are both preserved", () => {
    const result = buildShoppingList(
      [ing("Olive Oil", 2, "tbsp"), ing("Olive Oil", 1, "tbsp")],
      new Set(),
    );
    const oilItem = result.categories["pantry"]?.find(i => i.name.toLowerCase() === "olive oil");
    expect(oilItem).toBeDefined();
    expect(oilItem!.amounts).toHaveLength(2);
    expect(oilItem!.amounts).toContain("2 tbsp");
    expect(oilItem!.amounts).toContain("1 tbsp");
  });

  it("two different ingredients both appear", () => {
    const result = buildShoppingList(
      [ing("Chicken Breast"), ing("Broccoli")],
      new Set(),
    );
    expect(result.totalItems).toBe(2);
  });
});

// ─── Category grouping ────────────────────────────────────────────────────────

describe("buildShoppingList — category grouping", () => {
  it("chicken breast → protein category", () => {
    const result = buildShoppingList([ing("chicken breast")], new Set());
    expect(result.categories["protein"]).toBeDefined();
    expect(result.categories["protein"]!.some(i => i.name === "chicken breast")).toBe(true);
  });

  it("broccoli → produce category", () => {
    const result = buildShoppingList([ing("broccoli")], new Set());
    expect(result.categories["produce"]).toBeDefined();
  });

  it("garlic powder → pantry (not produce)", () => {
    const result = buildShoppingList([ing("garlic powder")], new Set());
    expect(result.categories["pantry"]).toBeDefined();
    expect(result.categories["produce"]).toBeUndefined();
  });

  it("frozen peas → frozen category", () => {
    const result = buildShoppingList([ing("frozen peas")], new Set());
    expect(result.categories["frozen"]).toBeDefined();
  });

  it("cheddar cheese → dairy category", () => {
    const result = buildShoppingList([ing("cheddar cheese")], new Set());
    expect(result.categories["dairy"]).toBeDefined();
  });
});

// ─── Staple flagging ──────────────────────────────────────────────────────────

describe("buildShoppingList — staple flagging", () => {
  it("ingredient in stapleNames is flagged as isStaple=true", () => {
    const result = buildShoppingList(
      [ing("olive oil")],
      new Set(["olive oil"]),
    );
    const item = result.categories["pantry"]?.find(i => i.name === "olive oil");
    expect(item?.isStaple).toBe(true);
  });

  it("ingredient not in stapleNames is flagged as isStaple=false", () => {
    const result = buildShoppingList([ing("olive oil")], new Set());
    const item = result.categories["pantry"]?.find(i => i.name === "olive oil");
    expect(item?.isStaple).toBe(false);
  });

  it("staple check is case-insensitive (stapleNames lowercased)", () => {
    const result = buildShoppingList(
      [ing("Olive Oil")],
      new Set(["olive oil"]),
    );
    const item = result.categories["pantry"]?.find(i => i.name === "Olive Oil");
    expect(item?.isStaple).toBe(true);
  });
});

// ─── Category order ───────────────────────────────────────────────────────────

describe("buildShoppingList — category ordering", () => {
  it("categories appear in CATEGORY_ORDER sequence", () => {
    const result = buildShoppingList(
      [
        ing("penne pasta"),
        ing("chicken breast"),
        ing("broccoli"),
        ing("olive oil"),
        ing("shredded cheddar cheese"),
      ],
      new Set(),
    );
    const presentCats = Object.keys(result.categories);
    const orderedPositions = presentCats
      .filter(c => CATEGORY_ORDER.includes(c as any))
      .map(c => CATEGORY_ORDER.indexOf(c as any));

    for (let i = 1; i < orderedPositions.length; i++) {
      expect(orderedPositions[i]).toBeGreaterThan(orderedPositions[i - 1]);
    }
  });

  it("items within a category are alphabetically sorted", () => {
    const result = buildShoppingList(
      [ing("zucchini"), ing("avocado"), ing("broccoli")],
      new Set(),
    );
    const names = result.categories["produce"]!.map(i => i.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("buildShoppingList — edge cases", () => {
  it("empty ingredient list returns zero items", () => {
    const result = buildShoppingList([], new Set());
    expect(result.totalItems).toBe(0);
    expect(Object.keys(result.categories)).toHaveLength(0);
  });

  it("totalItems reflects unique ingredient count, not raw count", () => {
    const result = buildShoppingList(
      [ing("salt"), ing("salt"), ing("pepper"), ing("salt")],
      new Set(),
    );
    expect(result.totalItems).toBe(2);
  });
});
