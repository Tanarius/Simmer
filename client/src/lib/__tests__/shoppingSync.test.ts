/**
 * Tests for syncRecipeItemsToShoppingList's abort behavior — chiefly the plan-not-loaded
 * guard: an undefined/null plan must NOT be treated as an empty plan and clear the recipe
 * items. A resolved-but-empty plan ("{}") still clears (the intentional path).
 *
 * The function was extracted to @/lib/shoppingSync precisely so it's importable here with
 * no DOM/React environment — fetch and localStorage are stubbed as globals.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { syncRecipeItemsToShoppingList, computeSyncKey } from "../shoppingSync";

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
}

const queryClient = { invalidateQueries: vi.fn() } as any;
let fetchMock: ReturnType<typeof vi.fn>;
let ls: ReturnType<typeof makeLocalStorage>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchMock = vi.fn();
  ls = makeLocalStorage();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("localStorage", ls);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("syncRecipeItemsToShoppingList — plan-not-loaded guard", () => {
  it("aborts silently (auto) when planMeals is undefined — no fetch, no sync-key write", async () => {
    const toast = vi.fn();
    const result = await syncRecipeItemsToShoppingList({
      planMeals: undefined, existingItems: [], syncKey: "k1", queryClient, toast, trigger: "auto",
    });
    expect(result).toEqual({ ok: false, count: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ls.store.has("k1")).toBe(false);
    expect(toast).not.toHaveBeenCalled();   // auto path stays silent
    expect(warnSpy).toHaveBeenCalled();
  });

  it("aborts with a destructive toast (manual) when planMeals is null — no fetch", async () => {
    const toast = vi.fn();
    const result = await syncRecipeItemsToShoppingList({
      planMeals: null, existingItems: [], syncKey: "k2", queryClient, toast, trigger: "manual",
    });
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ls.store.has("k2")).toBe(false);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Couldn't refresh from your plan",
      variant: "destructive",
    }));
  });

  it("a resolved-but-empty plan ('{}') still clears — one sync call with items:[] and writes the key", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ count: 0 }) });
    const toast = vi.fn();
    const result = await syncRecipeItemsToShoppingList({
      planMeals: "{}", existingItems: [], syncKey: "k3", queryClient, toast, trigger: "auto",
    });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/snacks/shopping/sync-recipe-items");
    expect(JSON.parse(opts.body)).toEqual({ items: [] });
    expect(ls.store.get("k3")).toBe("1"); // sync key written on the intentional clear
  });
});

describe("computeSyncKey", () => {
  it("uses the v2 prefix", () => {
    expect(computeSyncKey("2026-07-06", "{}")).toMatch(/^shopping-synced-v2-2026-07-06-/);
  });
});
