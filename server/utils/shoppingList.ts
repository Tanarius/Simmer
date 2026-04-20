import { guessCategory } from "./categorization";

export type RawIngredient = { name: string; amount: number | string; unit: string };
export type ShoppingListItem = { name: string; amounts: string[]; isStaple: boolean };
export type ShoppingListResult = {
  totalItems: number;
  categories: Record<string, ShoppingListItem[]>;
};

export const CATEGORY_ORDER = [
  "produce", "protein", "dairy", "frozen", "bakery", "pantry", "grains", "condiments",
] as const;

/**
 * Build a deduplicated, grouped, sorted shopping list from a flat ingredient list.
 *
 * stapleNames must contain lowercase ingredient names.
 * Category is always re-derived via guessCategory — never trust stored ing.category.
 */
export function buildShoppingList(
  allIngredients: RawIngredient[],
  stapleNames: Set<string>,
): ShoppingListResult {
  const ingredientMap = new Map<string, { name: string; amounts: string[]; category: string; isStaple: boolean }>();

  for (const ing of allIngredients) {
    const key = ing.name.toLowerCase();
    const amountStr = `${ing.amount} ${ing.unit}`;
    const isStaple = stapleNames.has(key);
    const category = guessCategory(ing.name);

    if (ingredientMap.has(key)) {
      ingredientMap.get(key)!.amounts.push(amountStr);
    } else {
      ingredientMap.set(key, { name: ing.name, amounts: [amountStr], category, isStaple });
    }
  }

  // Group by category
  const grouped: Record<string, ShoppingListItem[]> = {};
  for (const [, item] of ingredientMap) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push({ name: item.name, amounts: item.amounts, isStaple: item.isStaple });
  }

  // Sort categories in shopping-aisle order, then alpha within each
  const sortedGroups: Record<string, ShoppingListItem[]> = {};
  for (const cat of CATEGORY_ORDER) {
    if (grouped[cat]) sortedGroups[cat] = grouped[cat].sort((a, b) => a.name.localeCompare(b.name));
  }
  for (const cat of Object.keys(grouped)) {
    if (!sortedGroups[cat]) sortedGroups[cat] = grouped[cat].sort((a, b) => a.name.localeCompare(b.name));
  }

  return { totalItems: ingredientMap.size, categories: sortedGroups };
}
