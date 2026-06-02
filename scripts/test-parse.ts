import { parseRecipeQuery } from "../server/utils/parseRecipeQuery";

const tests = [
  "quick american dinners",
  "easy italian pasta",
  "mexican food",
  "healthy breakfast",
  "slow cooker pulled pork",
  "under 30 chicken stir fry",
];

for (const t of tests) {
  const r = parseRecipeQuery(t);
  console.log(`\nInput: "${t}"`);
  console.log(`  cuisine=${r.cuisine ?? "none"} exclude=${r.excludeCuisine ?? "none"}`);
  console.log(`  mealType=${r.mealType ?? "none"} maxReadyTime=${r.maxReadyTime ?? "none"}`);
  console.log(`  diet=${r.diet ?? "none"} tags=[${r.tags.join(",")}]`);
  console.log(`  searchText="${r.searchText}"`);
}
