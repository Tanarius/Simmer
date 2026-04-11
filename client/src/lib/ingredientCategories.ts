export interface IngredientCategory {
  key: string;
  label: string;
  emoji: string;
  /** Tailwind classes for the category header text */
  headerClass: string;
  /** Tailwind classes for the left accent bar */
  barClass: string;
  /** Tailwind classes for chip/badge backgrounds */
  chipClass: string;
  keywords: string[];
}

export const INGREDIENT_CATEGORIES: IngredientCategory[] = [
  {
    key: 'protein',
    label: 'Proteins',
    emoji: '🥩',
    headerClass: 'text-red-600 dark:text-red-400',
    barClass: 'bg-red-400 dark:bg-red-500',
    chipClass: 'bg-red-100 text-red-700 dark:bg-red-900/25 dark:text-red-300',
    keywords: [
      'chicken', 'beef', 'pork', 'lamb', 'turkey', 'salmon', 'tuna', 'shrimp',
      'crab', 'lobster', 'bacon', 'ham', 'sausage', 'steak', 'brisket', 'ribs',
      'duck', 'veal', 'venison', 'anchov', 'cod', 'halibut', 'tilapia', 'mahi',
      'scallop', 'clam', 'mussel', 'oyster', 'prosciutto', 'pancetta', 'chorizo',
      'pepperoni', 'ground beef', 'ground turkey', 'ground pork', 'loin',
      'tenderloin', 'breast', 'thigh', 'drumstick', 'wing', 'filet', 'fillet',
      'egg', 'eggs',
    ],
  },
  {
    key: 'vegetable',
    label: 'Vegetables',
    emoji: '🥦',
    headerClass: 'text-green-600 dark:text-green-400',
    barClass: 'bg-green-400 dark:bg-green-500',
    chipClass: 'bg-green-100 text-green-700 dark:bg-green-900/25 dark:text-green-300',
    keywords: [
      'spinach', 'kale', 'broccoli', 'zucchini', 'cucumber', 'celery', 'lettuce',
      'arugula', 'asparagus', 'peas', 'edamame', 'leek', 'scallion', 'green bean',
      'snap pea', 'bok choy', 'cabbage', 'brussels', 'artichoke', 'fennel',
      'watercress', 'endive', 'chard', 'collard', 'cauliflower', 'radish',
      'turnip', 'parsnip', 'rutabaga', 'kohlrabi',
    ],
  },
  {
    key: 'herb',
    label: 'Herbs & Spices',
    emoji: '🌿',
    headerClass: 'text-emerald-600 dark:text-emerald-400',
    barClass: 'bg-emerald-400 dark:bg-emerald-500',
    chipClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300',
    keywords: [
      'basil', 'cilantro', 'parsley', 'oregano', 'thyme', 'rosemary', 'mint',
      'dill', 'sage', 'chive', 'tarragon', 'bay leaf', 'marjoram', 'lavender',
      'lemongrass', 'cumin', 'paprika', 'turmeric', 'coriander', 'cinnamon',
      'cayenne', 'chili powder', 'curry powder', 'cardamom', 'clove', 'nutmeg',
      'allspice', 'star anise', 'garam masala', 'za\'atar', 'sumac',
    ],
  },
  {
    key: 'dairy',
    label: 'Dairy',
    emoji: '🧀',
    headerClass: 'text-yellow-600 dark:text-yellow-400',
    barClass: 'bg-yellow-400 dark:bg-yellow-500',
    chipClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/25 dark:text-yellow-300',
    keywords: [
      'cheese', 'milk', 'cream', 'butter', 'yogurt', 'parmesan', 'mozzarella',
      'cheddar', 'ricotta', 'feta', 'brie', 'gouda', 'gruyere', 'provolone',
      'cotija', 'queso', 'half and half', 'heavy cream', 'sour cream',
      'cream cheese', 'whipped cream', 'ghee', 'lactose',
    ],
  },
  {
    key: 'grain',
    label: 'Grains & Carbs',
    emoji: '🌾',
    headerClass: 'text-amber-600 dark:text-amber-400',
    barClass: 'bg-amber-400 dark:bg-amber-500',
    chipClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300',
    keywords: [
      'rice', 'pasta', 'bread', 'flour', 'noodle', 'tortilla', 'quinoa', 'oat',
      'barley', 'couscous', 'polenta', 'grits', 'orzo', 'farro', 'bulgur',
      'spaghetti', 'penne', 'linguine', 'fettuccine', 'lasagna', 'gnocchi',
      'ramen', 'udon', 'soba', 'panko', 'breadcrumb', 'crouton',
    ],
  },
  {
    key: 'produce',
    label: 'Produce',
    emoji: '🍅',
    headerClass: 'text-orange-600 dark:text-orange-400',
    barClass: 'bg-orange-400 dark:bg-orange-500',
    chipClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/25 dark:text-orange-300',
    keywords: [
      'tomato', 'lemon', 'lime', 'orange', 'apple', 'mango', 'avocado',
      'bell pepper', 'pepper', 'corn', 'carrot', 'sweet potato', 'potato',
      'beet', 'pumpkin', 'squash', 'eggplant', 'mushroom', 'onion', 'shallot',
      'garlic', 'ginger', 'jalapeno', 'serrano', 'habanero', 'poblano',
      'banana', 'strawberry', 'blueberry', 'raspberry', 'pineapple', 'peach',
      'plum', 'cherry', 'grape', 'watermelon', 'cantaloupe',
    ],
  },
  {
    key: 'legume',
    label: 'Legumes',
    emoji: '🫘',
    headerClass: 'text-stone-600 dark:text-stone-400',
    barClass: 'bg-stone-400 dark:bg-stone-500',
    chipClass: 'bg-stone-100 text-stone-700 dark:bg-stone-800/50 dark:text-stone-300',
    keywords: [
      'bean', 'lentil', 'chickpea', 'tofu', 'tempeh', 'black bean', 'kidney bean',
      'pinto bean', 'navy bean', 'cannellini', 'hummus', 'miso', 'edamame',
    ],
  },
];

const PANTRY_CATEGORY: IngredientCategory = {
  key: 'pantry',
  label: 'Pantry',
  emoji: '🫙',
  headerClass: 'text-slate-500 dark:text-slate-400',
  barClass: 'bg-slate-300 dark:bg-slate-600',
  chipClass: 'bg-muted text-muted-foreground',
  keywords: [],
};

export function categorizeIngredient(name: string): IngredientCategory {
  const lower = name.toLowerCase();
  for (const cat of INGREDIENT_CATEGORIES) {
    if (cat.keywords.some(kw => lower.includes(kw))) return cat;
  }
  return PANTRY_CATEGORY;
}

export function getIngredientChipClass(name: string): string {
  return categorizeIngredient(name).chipClass;
}

/** Groups an array of ingredients by their inferred category, preserving category order. */
export function groupIngredientsByCategory<T extends { name: string }>(
  ingredients: T[]
): Array<{ category: IngredientCategory; items: T[] }> {
  const map = new Map<string, { category: IngredientCategory; items: T[] }>();

  for (const ing of ingredients) {
    const cat = categorizeIngredient(ing.name);
    if (!map.has(cat.key)) {
      map.set(cat.key, { category: cat, items: [] });
    }
    map.get(cat.key)!.items.push(ing);
  }

  // Sort groups by the canonical order defined in INGREDIENT_CATEGORIES, pantry last
  const order = [...INGREDIENT_CATEGORIES.map(c => c.key), 'pantry'];
  return [...map.values()].sort(
    (a, b) => order.indexOf(a.category.key) - order.indexOf(b.category.key)
  );
}
