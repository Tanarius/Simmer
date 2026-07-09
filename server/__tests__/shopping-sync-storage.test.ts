/**
 * Atomicity tests for storage.syncRecipeShoppingItems — the transactional recipe-item
 * swap that guarantees the shopping list can never be left emptied by a failed sync.
 *
 * The suite forbids a real DB, so Drizzle is mocked: db.transaction runs the callback
 * with a fake tx whose delete/insert are spies. This proves the CODE is structurally
 * atomic — delete and insert are issued inside one transaction callback, and an insert
 * failure propagates so the whole callback aborts. Real Postgres rollback is then
 * guaranteed by db.transaction (the same primitive proven by deleteUserData).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted so the mocks exist when the hoisted vi.mock factories below run.
const h = vi.hoisted(() => {
  const state = { insertRows: [] as any[], insertShouldThrow: false };
  const txDelete = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
  const txInsert = vi.fn(() => ({
    values: vi.fn((rows: any[]) => {
      state.insertRows = rows;
      return {
        returning: vi.fn(() =>
          state.insertShouldThrow
            ? Promise.reject(new Error("insert failed"))
            : Promise.resolve(rows.map((r, i) => ({ id: i + 1, ...r }))),
        ),
      };
    }),
  }));
  const mockTx = { delete: txDelete, insert: txInsert };
  const mockDb = { transaction: vi.fn(async (cb: any) => cb(mockTx)) };
  return { state, txDelete, txInsert, mockTx, mockDb };
});

vi.mock("pg", () => ({ Pool: class MockPool {} }));
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => h.mockDb }));

import { storage } from "../storage";

beforeEach(() => {
  vi.clearAllMocks();
  h.state.insertRows = [];
  h.state.insertShouldThrow = false;
  h.mockDb.transaction.mockImplementation(async (cb: any) => cb(h.mockTx));
});

describe("storage.syncRecipeShoppingItems — atomic swap", () => {
  it("replaces recipe items with 80 new ones in a single transaction, forcing source='recipe'", async () => {
    const items = Array.from({ length: 80 }, (_, i) => ({ name: `Item ${i}`, category: "produce" }));
    const result = await storage.syncRecipeShoppingItems(1, 2, items);

    expect(h.mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(h.txDelete).toHaveBeenCalledTimes(1);          // stale recipe items cleared...
    expect(h.txInsert).toHaveBeenCalledTimes(1);          // ...and the new set inserted, same tx
    expect(h.state.insertRows).toHaveLength(80);
    expect(h.state.insertRows.every(r => r.source === "recipe")).toBe(true);
    expect(h.state.insertRows.every(r => r.householdId === 1 && r.addedBy === 2)).toBe(true);
    expect(result).toHaveLength(80);
  });

  it("clears recipe items with an empty array without inserting", async () => {
    const result = await storage.syncRecipeShoppingItems(1, 2, []);
    expect(h.txDelete).toHaveBeenCalledTimes(1);
    expect(h.txInsert).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("rolls back atomically when the insert fails — delete and insert share one tx, error propagates", async () => {
    h.state.insertShouldThrow = true;
    await expect(
      storage.syncRecipeShoppingItems(1, 2, [{ name: "Chicken" }]),
    ).rejects.toThrow("insert failed");
    // The delete was issued inside the same transaction callback as the failing insert,
    // so Postgres rolls both back — the prior recipe items survive.
    expect(h.mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(h.txDelete).toHaveBeenCalledTimes(1);
    expect(h.txInsert).toHaveBeenCalledTimes(1);
  });
});
