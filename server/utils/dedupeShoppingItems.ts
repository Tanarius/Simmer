/**
 * Merges duplicate shopping list items by normalising names and combining
 * numeric quantities where possible.
 *
 * Example:
 *   "chicken breast (1 lb)"  +  "chicken breast (2 lb)"  →  "chicken breast (3 lb)"
 *   "garlic (3 cloves)"      +  "garlic (2 cloves)"      →  "garlic (5 cloves)"
 *   "salt"                   +  "salt"                   →  "salt"  (just one row)
 */

interface RawItem {
  name: string;
  amount?: string;
  unit?: string;
  category?: string;
  source?: string;
  sourceId?: number;
}

// Units we can numerically add
const ADDABLE_UNITS = new Set([
  "lb", "lbs", "pound", "pounds",
  "oz", "ounce", "ounces",
  "g", "gram", "grams",
  "kg", "kilogram", "kilograms",
  "cup", "cups", "c",
  "tbsp", "tablespoon", "tablespoons",
  "tsp", "teaspoon", "teaspoons",
  "ml", "milliliter", "milliliters",
  "l", "liter", "liters",
  "clove", "cloves",
  "piece", "pieces",
  "slice", "slices",
  "can", "cans",
  "bag", "bags",
  "bunch", "bunches",
  "head", "heads",
  "stalk", "stalks",
  "sprig", "sprigs",
]);

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    // strip common adjectives that cause false mismatches
    .replace(/\b(boneless|skinless|fresh|frozen|dried|chopped|diced|minced|sliced|whole|large|medium|small)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseUnit(unit: string | undefined): string {
  if (!unit) return "";
  const u = unit.toLowerCase().trim();
  // Consolidate plural/singular
  if (["lbs", "pound", "pounds"].includes(u)) return "lb";
  if (["ounce", "ounces"].includes(u)) return "oz";
  if (["gram", "grams"].includes(u)) return "g";
  if (["kilogram", "kilograms"].includes(u)) return "kg";
  if (["cups", "c"].includes(u)) return "cup";
  if (["tablespoon", "tablespoons"].includes(u)) return "tbsp";
  if (["teaspoon", "teaspoons"].includes(u)) return "tsp";
  if (["milliliter", "milliliters"].includes(u)) return "ml";
  if (["liter", "liters"].includes(u)) return "l";
  if (["cloves"].includes(u)) return "clove";
  if (["pieces"].includes(u)) return "piece";
  if (["slices"].includes(u)) return "slice";
  if (["cans"].includes(u)) return "can";
  if (["bags"].includes(u)) return "bag";
  if (["bunches"].includes(u)) return "bunch";
  if (["heads"].includes(u)) return "head";
  if (["stalks"].includes(u)) return "stalk";
  if (["sprigs"].includes(u)) return "sprig";
  return u;
}

function parseAmount(amount: string | undefined): number | null {
  if (!amount) return null;
  // Handle fractions like "1/2", "1 1/2"
  const fracMatch = amount.trim().match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (fracMatch) return parseInt(fracMatch[1]) + parseInt(fracMatch[2]) / parseInt(fracMatch[3]);
  const simpleFrac = amount.trim().match(/^(\d+)\/(\d+)$/);
  if (simpleFrac) return parseInt(simpleFrac[1]) / parseInt(simpleFrac[2]);
  const num = parseFloat(amount);
  return isNaN(num) ? null : num;
}

function formatAmount(n: number): string {
  // Show as integer if whole, else 1 decimal place
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

export function dedupeShoppingItems(items: RawItem[]): RawItem[] {
  // key: normalisedName + normalisedUnit
  const map = new Map<string, RawItem & { _total: number | null; _canAdd: boolean }>();

  for (const item of items) {
    const normName = normaliseName(item.name);
    const normUnit = normaliseUnit(item.unit);
    const key = `${normName}||${normUnit}`;

    if (!map.has(key)) {
      const parsed = parseAmount(item.amount);
      const canAdd = normUnit ? ADDABLE_UNITS.has(normUnit) : false;
      map.set(key, {
        ...item,
        name: item.name, // keep original casing of first occurrence
        unit: normUnit || item.unit,
        _total: canAdd ? parsed : null,
        _canAdd: canAdd,
      });
    } else {
      const existing = map.get(key)!;
      if (existing._canAdd && existing._total !== null) {
        const parsed = parseAmount(item.amount);
        if (parsed !== null) {
          existing._total += parsed;
          existing.amount = formatAmount(existing._total);
        }
      }
      // Merge source info — keep first source, combine sourceIds if different
    }
  }

  return Array.from(map.values()).map(({ _total, _canAdd, ...item }) => item);
}
