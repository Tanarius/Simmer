/**
 * Ingredient and recipe categorization utilities.
 *
 * IMPORTANT: guessCategory() is always re-run at shopping list generation time.
 * Never trust the category value stored on a recipe ingredient — run this instead.
 *
 * Ordering: protein → frozen → bakery → grains → dairy → condiments → pantry → produce
 *
 * Key ordering rules:
 * - frozen before bakery/grains/produce so "frozen corn" → frozen, not produce
 * - bakery before grains with \bbread\b so "breadcrumbs" → grains, not bakery
 * - grains before dairy so "egg noodles" → grains, not dairy
 * - condiments before pantry so "tomato paste" → condiments, not pantry
 * - pantry before produce so "garlic powder" → pantry, not produce
 */
export function guessCategory(name: string): string {
  const lower = name.toLowerCase();

  // Protein — specific patterns to avoid false positives:
  // \bfish\b(?!\s+sauce) prevents "fish sauce" → protein
  // \broast\b prevents "roasted vegetables" → protein
  // \bchicken\b(?!\s+bouillon) prevents "chicken bouillon cube" → protein
  if (/\bchicken\b(?!\s+bouillon)|\bbeef\b|\bpork\b|sausage|turkey|shrimp|salmon|\bfish\b(?!\s+sauce)|bacon|steak|lamb|ground\s+(?:meat|beef|turkey)|\broast\b|\bbroth\b|\bstock\b/.test(lower)) return "protein";

  // Frozen — before bakery/grains/produce so "frozen corn" → frozen, not produce
  if (/frozen/.test(lower)) return "frozen";

  // Bakery — before grains so "flour tortillas" → bakery, not grains;
  // \bbread\b (word boundary) so "breadcrumbs" → grains, not bakery
  if (/\bbread\b|rolls?|buns?|tortilla|naan|pita|hoagie|baguette/.test(lower)) return "bakery";

  // Grains — before dairy so "egg noodles" → grains, not dairy
  if (/\brice\b|pasta|\bnoodle|quinoa|\boats\b|farro|couscous|flour|cornstarch|breadcrumb/.test(lower)) return "grains";

  // Dairy
  if (/cheese|milk|cream|butter|yogurt|\beggs?\b|sour cream/.test(lower)) return "dairy";

  // Condiments — before pantry so "tomato paste" → condiments, not pantry
  if (/\bsauce\b|vinegar|mustard|ketchup|mayo(?:nnaise)?|sriracha|dressing|salsa|\bpaste\b|soy sauce|fish sauce|hoisin|teriyaki|worcestershire|oyster sauce/.test(lower)) return "condiments";

  // Pantry — before produce so "garlic powder" → pantry, not produce.
  // Use specific pepper phrases (not generic "pepper\b") to avoid catching "bell pepper".
  // Use specific clove phrases to avoid catching "garlic cloves".
  if (/powder|dried|flakes|\bsalt\b|\bblack pepper\b|\bwhite pepper\b|\bground pepper\b|paprika|cumin|coriander|oregano|thyme|rosemary|bay leaf|cayenne|\bchili\b|turmeric|cinnamon|nutmeg|ground cloves|whole cloves|allspice|seasoning|spice|herb mix|bouquet|extract|vanilla|baking soda|baking powder|yeast|sugar|brown sugar|honey|syrup|oil|olive oil|vegetable oil|canola|coconut oil|lard|shortening|cornmeal|bouillon|broth cube|can |canned|jar |jarred/.test(lower)) return "pantry";

  // Produce — after pantry so "garlic powder" doesn't reach this check
  if (/\bonion\b|\bgarlic\b|bell pepper|\bpepper\b|tomato|lettuce|avocado|\blime\b|\blemon\b|cilantro|basil|fresh ginger|\bbroccoli\b|carrot|celery|potato|mushroom|spinach|kale|jalap|zucchini|\bcorn\b|cucumber|parsley|green onion|scallion|shallot|leek|fennel|asparagus|artichoke|bok choy|cabbage|beet|radish|turnip|sweet potato|yam|squash|pumpkin/.test(lower)) return "produce";

  return "pantry";
}

/**
 * Guess cuisine from recipe title + ingredient list.
 * Used for URL imports and Spoonacular saves.
 */
export function guessCuisine(title: string, ingredients: string[]): string {
  const blob = (title + " " + ingredients.join(" ")).toLowerCase();
  if (/soy sauce|sesame|teriyaki|stir.?fry|wok|ramen|thai|fish sauce|hoisin|kimchi|miso|pad kra|rice vinegar|bok choy|asian|chinese|japanese|korean|vietnamese|szechuan|kung pao|lo mein|pho|bibimbap|bulgogi|sriracha|lemongrass/.test(blob)) return "asian";
  if (/tikka|masala|garam|tandoori|naan|basmati|paneer|samosa|curry|chutney|dal|dahl|biryani|turmeric|cumin|coriander seed|cardamom|indian/.test(blob)) return "indian";
  // Tex-Mex: require "tex-mex"/"mexican" as explicit labels, OR 2+ food-specific words.
  // "salsa" and "tortilla" removed — too common in Spanish/Mediterranean cooking.
  {
    const texMexWords = ["taco","enchilada","burrito","quesadilla","fajita","carnitas","chipotle","jalapeño","jalap","tamale","queso","chile verde"];
    const explicit = /tex.?mex|mexican/.test(blob);
    const wordCount = texMexWords.filter(w => blob.includes(w)).length;
    if (explicit || wordCount >= 2) return "tex-mex";
  }
  if (/pasta|marinara|parmesan|mozzarella|italian|risotto|penne|fettuccine|lasagna|alfredo|prosciutto|bruschetta|bolognese|carbonara|pesto|gnocchi|ravioli|ciabatta/.test(blob)) return "italian";
  if (/hummus|falafel|tahini|shawarma|gyro|tzatziki|pita|greek|mediterranean|moroccan|feta|olives|couscous|harissa|za'atar|sumac|kebab|turkish|lebanese/.test(blob)) return "mediterranean";
  if (/bbq|barbecue|biscuit|gravy|pot roast|corn bread|soul food|southern|cajun|creole|gumbo|jambalaya|mac.?and.?cheese|burger|meatloaf|chili|american|tater tot|casserole|chicken and dump|pulled pork|sloppy joe|wild rice|pot pie|clam chowder|yankee|buffalo wing/.test(blob)) return "american";
  return "other";
}
