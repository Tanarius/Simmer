export interface ParsedQuery {
  searchText: string;
  cuisine?: string;
  excludeCuisine?: string;
  mealType?: string;
  maxReadyTime?: number;
  tags: string[];
  diet?: string;
}

/** Remove matched pattern from text and return whether it matched */
function pluck(text: string, pattern: RegExp): [string, boolean] {
  if (!pattern.test(text)) return [text, false];
  return [text.replace(pattern, ' ').replace(/\s{2,}/g, ' ').trim(), true];
}

export function parseRecipeQuery(raw: string): ParsedQuery {
  let t = raw.toLowerCase().trim();
  const result: ParsedQuery = { searchText: '', tags: [] };

  // ── Cuisine ──────────────────────────────────────────────────────────────────
  const CUISINE_RULES: [RegExp, string, string?][] = [
    [/\b(american|usa|u\.s\.a?|us food|all-american)\b/, 'american', 'canadian'],
    [/\b(southern|soul\s+food|bbq|barbecue|comfort\s+food)\b/, 'american', 'canadian'],
    [/\b(italian|italy|pasta|pizza|risotto|carbonara|bolognese|pesto|lasagna)\b/, 'italian'],
    [/\b(mexican|mexico|tacos?|burritos?|enchiladas?|quesadillas?|guacamole|salsa)\b/, 'mexican'],
    [/\b(tex-mex|texmex|tex\s+mex)\b/, 'mexican'],
    [/\b(chinese|china|dim\s+sum|dumplings|fried\s+rice|chow\s+mein|orange\s+chicken)\b/, 'chinese'],
    [/\b(japanese|japan|sushi|ramen|udon|tempura|teriyaki|miso|yakitori)\b/, 'japanese'],
    [/\b(korean|korea|kimchi|bibimbap|bulgogi|gochujang)\b/, 'korean'],
    [/\b(thai|thailand|pad\s+thai|green\s+curry|tom\s+yum)\b/, 'thai'],
    [/\b(vietnamese|vietnam|pho|banh\s+mi|spring\s+rolls)\b/, 'vietnamese'],
    [/\b(asian)\b/, 'asian'],
    [/\b(indian|india|curry|tikka\s+masala|biryani|tandoori|saag|dal|naan)\b/, 'indian'],
    [/\b(mediterranean|hummus|falafel|gyros?|shawarma|tabbouleh)\b/, 'mediterranean'],
    [/\b(greek|greece)\b/, 'mediterranean'],
    [/\b(french|france|croissant|ratatouille|boeuf|coq\s+au\s+vin)\b/, 'french'],
    [/\b(middle\s+eastern|arabic|lebanese|persian|moroccan)\b/, 'middle eastern'],
  ];

  for (const [pattern, cuisine, exclude] of CUISINE_RULES) {
    const [next, matched] = pluck(t, pattern);
    if (matched) {
      t = next;
      result.cuisine = cuisine;
      if (exclude) result.excludeCuisine = exclude;
      break;
    }
  }

  // ── Meal type ────────────────────────────────────────────────────────────────
  let [next, matched] = pluck(t, /\b(breakfast|brunch|morning\s+meal)\b/);
  if (matched) { t = next; result.mealType = 'breakfast'; }

  [next, matched] = pluck(t, /\b(lunch|midday\s+meal)\b/);
  if (matched) { t = next; result.mealType = 'lunch'; }

  [next, matched] = pluck(t, /\b(dinner|supper|evening\s+meal)\b/);
  if (matched) { t = next; result.mealType = 'dinner'; }

  // ── Time / difficulty ────────────────────────────────────────────────────────
  [next, matched] = pluck(t, /\b(quick|fast|weeknight|under\s+30|30[\s-]min(utes?)?|in\s+30|30\s+minute(s)?)\b/);
  if (matched) { t = next; result.maxReadyTime = 30; if (!result.tags.includes('quick')) result.tags.push('quick'); }

  if (!result.maxReadyTime) {
    [next, matched] = pluck(t, /\b(easy|simple|speedy)\b/);
    if (matched) { t = next; result.maxReadyTime = 30; if (!result.tags.includes('quick')) result.tags.push('quick'); }
  }

  if (!result.maxReadyTime) {
    [next, matched] = pluck(t, /\b(under\s+45|45[\s-]min(utes?)?)\b/);
    if (matched) { t = next; result.maxReadyTime = 45; }
  }

  if (!result.maxReadyTime) {
    [next, matched] = pluck(t, /\b(under\s+(an\s+)?hour|under\s+60|60[\s-]min(utes?)?|an\s+hour)\b/);
    if (matched) { t = next; result.maxReadyTime = 60; }
  }

  // ── Diet ─────────────────────────────────────────────────────────────────────
  [next, matched] = pluck(t, /\b(vegan)\b/);
  if (matched) { t = next; result.diet = 'vegan'; }

  if (!result.diet) {
    [next, matched] = pluck(t, /\b(vegetarian|veggie)\b/);
    if (matched) { t = next; result.diet = 'vegetarian'; }
  }

  if (!result.diet) {
    [next, matched] = pluck(t, /\b(gluten[-\s]free)\b/);
    if (matched) { t = next; result.diet = 'gluten free'; }
  }

  if (!result.diet) {
    [next, matched] = pluck(t, /\b(keto|ketogenic)\b/);
    if (matched) { t = next; result.diet = 'ketogenic'; }
  }

  if (!result.diet) {
    [next, matched] = pluck(t, /\b(paleo)\b/);
    if (matched) { t = next; result.diet = 'paleo'; }
  }

  if (!result.diet) {
    [next, matched] = pluck(t, /\b(dairy[-\s]free)\b/);
    if (matched) { t = next; result.diet = 'dairy free'; }
  }

  if (!result.diet) {
    [next, matched] = pluck(t, /\b(healthy|light|low[-\s]?cal(orie)?)\b/);
    if (matched) { t = next; result.tags.push('healthy'); }
  }

  // ── Cooking method tags ───────────────────────────────────────────────────────
  [next, matched] = pluck(t, /\b(air[-\s]fry(er|ed)?)\b/);
  if (matched) { t = next; result.tags.push('air-fryer'); }

  [next, matched] = pluck(t, /\b(slow[-\s]cook(er|ed)?|crock[-\s]?pot)\b/);
  if (matched) { t = next; result.tags.push('crockpot'); }

  [next, matched] = pluck(t, /\b(one[-\s]pan|sheet[-\s]pan)\b/);
  if (matched) { t = next; result.tags.push('one-pan'); }

  [next, matched] = pluck(t, /\b(one[-\s]pot)\b/);
  if (matched) { t = next; result.tags.push('one-pot'); }

  [next, matched] = pluck(t, /\b(make[-\s]ahead|meal[-\s]prep|batch[-\s]cook(ing)?)\b/);
  if (matched) { t = next; result.tags.push('make-ahead'); }

  [next, matched] = pluck(t, /\b(grilled?|grill)\b/);
  if (matched) { t = next; result.tags.push('grilled'); }

  // ── Clean up remaining search text ───────────────────────────────────────────
  // Remove high-frequency filler words that add no signal to Spoonacular
  t = t.replace(/\b(food|dish(es)?|meal(s)?|recipe(s)?|cook(ing)?|make|for\s+me|some|good|great|best|delicious|tasty|yummy)\b/gi, ' ')
       .replace(/\s{2,}/g, ' ')
       .trim();

  result.searchText = t;
  return result;
}

/** Map a cuisine chip value to the ParsedQuery cuisine + excludeCuisine */
export function cuisineChipToQuery(choice: string): Pick<ParsedQuery, 'cuisine' | 'excludeCuisine'> {
  const MAP: Record<string, { cuisine: string; excludeCuisine?: string }> = {
    american:       { cuisine: 'american', excludeCuisine: 'canadian' },
    'tex-mex':      { cuisine: 'mexican' },
    italian:        { cuisine: 'italian' },
    asian:          { cuisine: 'asian' },
    mediterranean:  { cuisine: 'mediterranean' },
    indian:         { cuisine: 'indian' },
    japanese:       { cuisine: 'japanese' },
    korean:         { cuisine: 'korean' },
    thai:           { cuisine: 'thai' },
    chinese:        { cuisine: 'chinese' },
    french:         { cuisine: 'french' },
    'middle-eastern': { cuisine: 'middle eastern' },
  };
  return MAP[choice] ?? { cuisine: choice };
}
