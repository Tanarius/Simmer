import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import { users, recipes, households } from "../shared/schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
  // 1. Exact user row
  const u = await db.select().from(users).where(eq(users.username, "simmer_test"));
  const user = u[0];
  console.log("simmer_test:", { id: user?.id, householdId: user?.householdId });

  if (!user?.householdId) { console.log("NO HOUSEHOLD"); await pool.end(); return; }

  // 2. Household row
  const hh = await db.select().from(households).where(eq(households.id, user.householdId));
  console.log("household:", hh[0]);

  // 3. Recipes in that household
  const r = await db.select({ id: recipes.id, name: recipes.name, householdId: recipes.householdId })
    .from(recipes).where(eq(recipes.householdId, user.householdId));
  console.log(`Recipes in householdId ${user.householdId}: ${r.length}`);
  r.slice(0, 5).forEach(x => console.log(" -", x.id, x.name));

  // 4. Raw SQL count as sanity check
  const raw = await pool.query("SELECT COUNT(*) FROM recipes WHERE household_id = $1", [user.householdId]);
  console.log("Raw SQL count:", raw.rows[0].count);

  // 5. All distinct householdIds in recipes table
  const all = await pool.query("SELECT DISTINCT household_id, COUNT(*) as n FROM recipes GROUP BY household_id ORDER BY household_id");
  console.log("All recipes by household_id:", all.rows);

  await pool.end();
}
main();
