/**
 * Backfill missing recipe images from Spoonacular/TheMealDB.
 * Run: npx tsx scripts/backfill-images.ts
 * Requires: DATABASE_URL and (optionally) SPOONACULAR_API_KEY in env.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, isNull } from "drizzle-orm";
import { recipes } from "../shared/schema";
import { searchRecipeImage } from "../server/services/spoonacular";

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL! }));

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const nullImageRecipes = await db
    .select({ id: recipes.id, name: recipes.name })
    .from(recipes)
    .where(isNull(recipes.imageUrl));

  console.log(`\nFound ${nullImageRecipes.length} recipe(s) with no image.\n`);

  if (nullImageRecipes.length === 0) {
    console.log("Nothing to backfill.");
    process.exit(0);
  }

  let updated = 0;
  let skipped = 0;

  for (const recipe of nullImageRecipes) {
    process.stdout.write(`  Searching for "${recipe.name}"... `);
    try {
      const { imageUrl } = await searchRecipeImage(recipe.name);
      if (imageUrl) {
        await db.update(recipes).set({ imageUrl }).where(eq(recipes.id, recipe.id));
        console.log(`✓  ${imageUrl}`);
        updated++;
      } else {
        console.log(`– no image found`);
        skipped++;
      }
    } catch (e) {
      console.log(`✗  error: ${(e as any)?.message}`);
      skipped++;
    }
    // Respect Spoonacular rate limits
    await sleep(500);
  }

  console.log(`\n✅ Done. Updated: ${updated}  /  Skipped: ${skipped}  /  Total: ${nullImageRecipes.length}`);
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
