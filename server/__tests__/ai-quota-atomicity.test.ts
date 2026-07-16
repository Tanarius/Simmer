/**
 * storage.incrementAiCalls / incrementCopilotCalls must be ATOMIC — a single
 * `UPDATE ... SET col = col + 1 RETURNING col`, never a read-then-write. A read-then-write
 * loses updates under concurrent bursts (two callers read the same value, both write +1 →
 * net +1). Drizzle is mocked so we can assert the SET value is a SQL expression (the atomic
 * `col + 1`) rather than a client-computed number, and that the method returns the DB's
 * post-increment count (so concurrent calls get distinct values → +2).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const state = { nextCount: 0 };
  const returning = vi.fn(async () => {
    const c = ++state.nextCount;
    return [{ aiCallsToday: c, copilotCallsToday: c }];
  });
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const mockDb = { update };
  return { state, returning, where, set, update, mockDb };
});

vi.mock("pg", () => ({ Pool: class MockPool {} }));
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => h.mockDb }));

import { storage } from "../storage";

beforeEach(() => {
  vi.clearAllMocks();
  h.state.nextCount = 0;
});

describe("storage atomic quota increments", () => {
  it("incrementAiCalls uses an atomic SQL `col + 1` (not a read-then-write number) and returns the DB count", async () => {
    const result = await storage.incrementAiCalls(1);

    expect(h.update).toHaveBeenCalledTimes(1);
    const setArg = h.set.mock.calls[0][0];
    // A read-then-write would pass a precomputed number; the atomic form passes a Drizzle
    // SQL expression object for `aiCallsToday`.
    expect(setArg.aiCallsToday).toBeTypeOf("object");
    expect(setArg.aiCallsToday).not.toBeTypeOf("number");
    expect(result.newCount).toBe(1); // straight from RETURNING
  });

  it("incrementCopilotCalls likewise uses an atomic SQL expression", async () => {
    const result = await storage.incrementCopilotCalls(1);
    const setArg = h.set.mock.calls[0][0];
    expect(setArg.copilotCallsToday).toBeTypeOf("object");
    expect(setArg.copilotCallsToday).not.toBeTypeOf("number");
    expect(result.newCount).toBe(1);
  });

  it("two concurrent increments get distinct DB-assigned counts (+2, no lost update)", async () => {
    const [a, b] = await Promise.all([storage.incrementAiCalls(1), storage.incrementAiCalls(1)]);
    expect(a.newCount).not.toBe(b.newCount);
    expect([a.newCount, b.newCount].sort()).toEqual([1, 2]);
    expect(h.update).toHaveBeenCalledTimes(2);
  });
});
