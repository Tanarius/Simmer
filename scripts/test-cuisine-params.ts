import { parseRecipeQuery } from "../server/utils/parseRecipeQuery";

// Simulate what searchRecipes does with cuisineBase
const CUISINE_EXCLUSIONS: Record<string, string> = {
  american: 'italian,french,indian,mexican,chinese,japanese,korean,thai,greek,mediterranean,middle eastern,vietnamese,spanish,german,nordic,eastern european,latin american,canadian',
  italian:  'american,indian,mexican,chinese,japanese,korean,thai,greek,middle eastern,vietnamese,spanish,french,german,nordic',
  mexican:  'american,italian,indian,chinese,japanese,korean,thai,greek,mediterranean,middle eastern,vietnamese,french',
};

const queries = [
  { text: "quick american dinners", chip: null },
  { text: "quick american dinners", chip: "american" },
  { text: "", chip: "american" },
  { text: "easy italian pasta", chip: null },
  { text: "", chip: "italian" },
];

for (const { text, chip } of queries) {
  const parsed = text ? parseRecipeQuery(text) : { searchText: '', tags: [] as string[], cuisine: undefined as string | undefined, excludeCuisine: undefined as string | undefined, mealType: undefined as string | undefined, maxReadyTime: undefined as number | undefined };
  if (chip && chip !== 'surprise') {
    parsed.cuisine = chip;
    parsed.excludeCuisine = 'canadian'; // from cuisineChipToQuery
  }
  const excludeCuisine = parsed.cuisine ? (CUISINE_EXCLUSIONS[parsed.cuisine] ?? parsed.excludeCuisine) : undefined;

  console.log(`\nInput: text="${text}" chip="${chip ?? 'none'}"`);
  console.log(`  cuisine=${parsed.cuisine ?? 'none'}`);
  console.log(`  excludeCuisine=${excludeCuisine ? excludeCuisine.split(',').length + ' cuisines' : 'none'}`);
  console.log(`  mealType=${parsed.mealType ?? 'none'}, maxReadyTime=${parsed.maxReadyTime ?? 'none'}`);
  console.log(`  searchText="${parsed.searchText}"`);
}
