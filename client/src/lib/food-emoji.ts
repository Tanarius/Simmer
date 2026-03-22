/**
 * Map recipe names/keywords to relevant food emojis.
 * Returns a primary emoji for the card banner.
 */

const keywordEmojis: [RegExp, string][] = [
  // Specific dishes first
  [/taco|nacho/i, "🌮"],
  [/burrito|wrap/i, "🌯"],
  [/enchilada|casserole/i, "🫕"],
  [/quesadilla/i, "🧀"],
  [/carnitas|pulled pork/i, "🥩"],
  [/chili/i, "🌶️"],
  [/soup|stew|broth/i, "🍲"],
  [/ramen|noodle|pho/i, "🍜"],
  [/stir.?fry|wok/i, "🥘"],
  [/fried rice/i, "🍚"],
  [/pasta|penne|fettuccine|alfredo|spaghetti|lasagna|ravioli|gnocchi/i, "🍝"],
  [/pizza/i, "🍕"],
  [/burger|hamburger/i, "🍔"],
  [/sandwich|sub|hoagie/i, "🥪"],
  [/salad/i, "🥗"],
  [/curry|tikka|masala/i, "🍛"],
  [/chicken/i, "🍗"],
  [/beef|steak/i, "🥩"],
  [/pork|bacon/i, "🥓"],
  [/shrimp|salmon|fish|seafood/i, "🦐"],
  [/rice bowl|bowl/i, "🍚"],
  [/pot pie|pie/i, "🥧"],
  [/bread|toast/i, "🍞"],
  [/pancake|waffle/i, "🧇"],
  [/egg|omelette|frittata/i, "🥚"],
];

// Fallback emojis by cuisine
const cuisineEmojis: Record<string, string[]> = {
  "tex-mex": ["🌮", "🌶️", "🫕", "🧀"],
  "italian": ["🍝", "🍕", "🫒", "🧄"],
  "asian": ["🥢", "🍜", "🍚", "🥘"],
  "american": ["🍔", "🥩", "🌽", "🧈"],
  "other": ["🍽️", "🥄", "🍴", "👨‍🍳"],
};

/**
 * Get a food emoji for a recipe based on name and cuisine.
 */
export function getFoodEmoji(name: string, cuisine: string): string {
  // Try keyword matching first
  for (const [pattern, emoji] of keywordEmojis) {
    if (pattern.test(name)) return emoji;
  }
  // Fallback: pick from cuisine set based on name hash for variety
  const emojis = cuisineEmojis[cuisine] || cuisineEmojis["other"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return emojis[Math.abs(hash) % emojis.length];
}

/**
 * Get a gradient background class based on cuisine type.
 */
export function getCuisineGradient(cuisine: string): string {
  switch (cuisine) {
    case "tex-mex":
      return "from-orange-400 to-red-500";
    case "italian":
      return "from-red-400 to-rose-600";
    case "asian":
      return "from-emerald-400 to-teal-600";
    case "american":
      return "from-blue-400 to-indigo-500";
    default:
      return "from-purple-400 to-violet-600";
  }
}
