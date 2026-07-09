// Plan → shopping-list sync logic, extracted from the shopping page so it can be unit
// tested without standing up a DOM/React test environment. No React or `@/` imports here —
// only injected dependencies (queryClient, toast) plus fetch/localStorage.
import type { QueryClient } from "@tanstack/react-query";

// Shape returned by POST /api/shopping-list (the generate step).
interface LegacyItem { name: string; amounts: string[]; isStaple: boolean; }
interface LegacyList { totalItems: number; recipeCount: number; categories: Record<string, LegacyItem[]>; }

// Minimal structural shape of an existing list item the sync needs to read.
interface ExistingItem { name: string; source: string | null; }

export type ToastFn = (opts: { title: string; description?: string; variant?: "destructive"; duration?: number }) => void;

// A stable localStorage key derived from the week + plan content, so a changed plan yields a
// new key and re-triggers the auto-sync.
// Prefix bumped to v2: the old delete-then-bulk bug could write a `shopping-synced-` key on
// its failure path (marking a plan "synced" when the list was actually emptied). The v2
// prefix invalidates those stale keys so every user gets one clean re-sync on deploy.
export function computeSyncKey(weekStart: string, meals: string): string {
  const planHash = meals.length.toString(36) + meals.slice(-12).replace(/\W/g, "");
  return `shopping-synced-v2-${weekStart}-${planHash}`;
}

/**
 * Single, safe plan→shopping-list sync. Generates the ingredient list from the plan, then
 * performs ONE atomic server-side swap (POST /api/snacks/shopping/sync-recipe-items),
 * checking res.ok. On success: invalidate the shopping query, success toast, write the sync
 * key. On failure: DO NOT write the key, so the next mount / plan change (or the refresh
 * button) retries. The swap is transactional server-side, so a failure never empties the list.
 *
 * Aborts (no sync call, no sync-key write) when the sync can't be trusted:
 *  - plan not loaded yet (`planMeals` is null/undefined) — abort rather than treat a missing
 *    plan as an empty one and clear the recipe items. A resolved-but-empty plan is a JSON
 *    string ("{}") and still flows to the intentional clear path.
 *  - the generate call fails, or the plan has filled meal slots but produces zero items
 *    (e.g. an AI plan storing recipe names, or an API hiccup) — otherwise it would wipe the
 *    recipe items. A genuinely empty plan (no filled slots) still syncs the empty set.
 *
 * `trigger` controls how an abort surfaces: "manual" (refresh button) shows a subtle toast;
 * "auto" (background sync) stays silent (console.warn).
 */
export async function syncRecipeItemsToShoppingList(params: {
  planMeals: string | null | undefined;
  existingItems: ExistingItem[];
  syncKey: string | null;
  queryClient: QueryClient;
  toast: ToastFn;
  trigger: "auto" | "manual";
}): Promise<{ ok: boolean; count: number }> {
  const { planMeals, existingItems, syncKey, queryClient, toast, trigger } = params;

  // Abort: never writes the sync key, so the sync retries on the next mount / plan change.
  const abort = (reason: string): { ok: boolean; count: number } => {
    if (trigger === "manual") {
      toast({
        title: "Couldn't refresh from your plan",
        description: "Your list is unchanged.",
        variant: "destructive",
      });
    } else {
      console.warn(`[shopping sync] aborted (${reason}) — list left unchanged`);
    }
    return { ok: false, count: 0 };
  };

  // Plan not loaded yet (query still pending / undefined) — abort rather than treating a
  // missing plan as an empty one and clearing recipe items. A resolved-but-empty plan is a
  // JSON string ("{}"), which is not null and flows to the intentional clear path below.
  if (planMeals == null) return abort("plan not loaded");

  try {
    const meals = planMeals ? JSON.parse(planMeals) : {};
    const filledSlots = Object.values(meals).filter((v) => !!v);
    const recipeIds = [...new Set(filledSlots.filter((v): v is number => typeof v === "number"))];
    const planHasMeals = filledSlots.length > 0;

    // Build the recipe-sourced item set. Manual (non-recipe) items are excluded so the
    // server never sees — and never touches — them.
    let newItems: { name: string; amount?: string; category: string }[] = [];
    if (recipeIds.length > 0) {
      const genRes = await fetch("/api/shopping-list", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ recipeIds }),
      });
      if (!genRes.ok) return abort(`generate ${genRes.status}`);
      const generated: LegacyList = await genRes.json();
      const manualNames = new Set(existingItems.filter(i => i.source !== "recipe").map(i => i.name.toLowerCase()));
      newItems = Object.entries(generated.categories).flatMap(([cat, catItems]) =>
        (catItems as LegacyItem[])
          .filter(item => !manualNames.has(item.name.toLowerCase()))
          .map(item => ({ name: item.name, amount: item.amounts[0] ?? undefined, category: cat }))
      );
    }

    // A plan with filled slots that yields no items is a wrongly-empty generation — don't
    // wipe the recipe items. Only a genuinely empty plan (no filled slots) syncs empty.
    if (planHasMeals && newItems.length === 0) return abort("empty generation for a non-empty plan");

    const res = await fetch("/api/snacks/shopping/sync-recipe-items", {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify({ items: newItems }),
    });
    if (!res.ok) throw new Error(`sync-recipe-items ${res.status}`);
    const data = await res.json().catch(() => ({ count: newItems.length }));

    queryClient.invalidateQueries({ queryKey: ["/api/snacks/shopping"] });
    if (syncKey) localStorage.setItem(syncKey, "1");
    toast({ title: `Shopping list synced with plan (${data.count ?? newItems.length} items)`, duration: 3000 });
    return { ok: true, count: data.count ?? newItems.length };
  } catch {
    // The swap is atomic server-side, so the existing list is intact. Do not write the
    // sync key — leave the plan un-synced so it retries.
    toast({
      title: "Couldn't update your shopping list",
      description: "Your existing items weren't changed.",
      variant: "destructive",
    });
    return { ok: false, count: 0 };
  }
}
