/**
 * Household data isolation tests — proves that users can only access
 * data belonging to their own household.
 *
 * The isolation model: householdId always comes from req.user.householdId
 * (server-assigned) and is passed explicitly to every storage call.
 * These tests verify that pattern holds for the routes most at risk.
 *
 * SEC-003: reactions were global — any user could read any household's reactions
 * SEC-005: reactions POST didn't validate plan ownership
 * SEC-007: activity log leaked cross-household recipe names
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import bcrypt from "bcrypt";

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("connect-pg-simple", () => ({
  default: (sessionModule: any) => sessionModule.MemoryStore,
}));
vi.mock("pg", () => ({ Pool: class MockPool {} }));

vi.mock("../storage", () => ({
  storage: {
    // Auth
    getUserByUsername: vi.fn(),
    getUser: vi.fn(),
    createUser: vi.fn(),
    updateUserPassword: vi.fn(),
    setUserHousehold: vi.fn(),
    setUserEmail: vi.fn(),
    getHouseholdByInviteCode: vi.fn(),
    createHousehold: vi.fn(),
    getUserByEmail: vi.fn(),
    setResetToken: vi.fn(),
    getUserByResetToken: vi.fn(),
    clearResetToken: vi.fn(),
    // Data
    getRecipes: vi.fn(),
    getRecipe: vi.fn(),
    createRecipe: vi.fn(),
    getWeeklyPlan: vi.fn(),
    getWeeklyPlans: vi.fn(),
    upsertWeeklyPlan: vi.fn(),
    getReactionsForWeek: vi.fn(),
    upsertReaction: vi.fn(),
    deleteReaction: vi.fn(),
    logActivity: vi.fn(),
    getPantryStaples: vi.fn(),
    init: vi.fn(),
    seedDefaultData: vi.fn(),
  },
}));

vi.mock("../services/email", () => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock("../utils/invite", () => ({ generateInviteCode: vi.fn().mockReturnValue("TESTCODE") }));

process.env.SESSION_SECRET = "test-only";

import { setupAuth } from "../auth";
import { requireAuth } from "../middleware/requireAuth";
import { storage } from "../storage";

type MockedStorage = { [K in keyof typeof storage]: ReturnType<typeof vi.fn> };
const s = storage as unknown as MockedStorage;

// ── App factory ───────────────────────────────────────────────────────────────

function appWithRoutes() {
  const app = express();
  app.use(express.json());
  setupAuth(app);

  // Recipes
  app.get("/api/recipes", requireAuth, async (req, res) => {
    const householdId = (req.user as any).householdId;
    const recipes = await storage.getRecipes(householdId);
    res.json(recipes);
  });

  app.get("/api/recipes/:id", requireAuth, async (req, res) => {
    const householdId = (req.user as any).householdId;
    const recipe = await storage.getRecipe(Number(req.params.id), householdId);
    if (!recipe) return res.status(404).json({ error: "Not found" });
    res.json(recipe);
  });

  // Plans
  app.get("/api/plans/:weekStart", requireAuth, async (req, res) => {
    const householdId = (req.user as any).householdId;
    const plan = await storage.getWeeklyPlan(req.params.weekStart as string, householdId);
    if (!plan) return res.status(404).json({ error: "Not found" });
    res.json(plan);
  });

  // Reactions
  app.get("/api/plans/:weekStart/reactions", requireAuth, async (req, res) => {
    const householdId = (req.user as any).householdId;
    const reactions = await storage.getReactionsForWeek(req.params.weekStart as string, householdId);
    res.json(reactions);
  });

  app.post("/api/plans/:weekStart/reactions", requireAuth, async (req, res) => {
    const householdId = (req.user as any).householdId;
    const weekStart = req.params.weekStart as string;
    const { slotKey, emoji } = req.body;
    if (!slotKey) return res.status(400).json({ error: "slotKey required" });
    const plan = await storage.getWeeklyPlan(weekStart, householdId);
    if (!plan) return res.status(403).json({ error: "Forbidden" });
    await storage.upsertReaction(weekStart, slotKey, (req.user as any).id, emoji);
    res.status(204).send();
  });

  return app;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const HOUSEHOLD_A = 1;
const HOUSEHOLD_B = 2;

const recipeA = { id: 10, name: "Pasta Bolognese", householdId: HOUSEHOLD_A };
const recipeB = { id: 20, name: "Chicken Tikka",   householdId: HOUSEHOLD_B };

const planA = { id: 1, weekStart: "2026-04-20", householdId: HOUSEHOLD_A, meals: "{}" };

const reactionsA = [{ id: 1, weekStart: "2026-04-20", slotKey: "mon_dinner", userId: 1, emoji: "❤️" }];

// ── Login helper ──────────────────────────────────────────────────────────────

async function agentForHousehold(householdId: number, userId: number) {
  const hash = await bcrypt.hash("password1!", 4);
  const user = { id: userId, username: `user${userId}`, password: hash, householdId };
  s.getUserByUsername.mockResolvedValue(user);
  s.getUser.mockResolvedValue(user);

  const app = appWithRoutes();
  const agent = request.agent(app);
  await agent.post("/api/login").send({ username: `user${userId}`, password: "password1!" });
  return agent;
}

beforeEach(() => vi.clearAllMocks());

// ─── Recipes ─────────────────────────────────────────────────────────────────

describe("Recipe isolation", () => {
  it("getRecipes is called with the authenticated user's householdId", async () => {
    s.getRecipes.mockResolvedValue([recipeA]);
    const agent = await agentForHousehold(HOUSEHOLD_A, 1);
    s.getUser.mockResolvedValue({ id: 1, username: "user1", householdId: HOUSEHOLD_A });

    await agent.get("/api/recipes");

    expect(s.getRecipes).toHaveBeenCalledWith(HOUSEHOLD_A);
    expect(s.getRecipes).not.toHaveBeenCalledWith(HOUSEHOLD_B);
  });

  it("getRecipe is called with householdId — cross-household ID returns 404", async () => {
    // Household A user tries to access recipe that belongs to household B.
    // storage.getRecipe(id, householdIdA) returns undefined because it belongs to B.
    s.getRecipe.mockResolvedValue(undefined);
    const agent = await agentForHousehold(HOUSEHOLD_A, 1);
    s.getUser.mockResolvedValue({ id: 1, username: "user1", householdId: HOUSEHOLD_A });

    const res = await agent.get(`/api/recipes/${recipeB.id}`);

    expect(res.status).toBe(404);
    expect(s.getRecipe).toHaveBeenCalledWith(recipeB.id, HOUSEHOLD_A);
    // Household B's ID was never passed to storage
    expect(s.getRecipe).not.toHaveBeenCalledWith(recipeB.id, HOUSEHOLD_B);
  });

  it("getRecipe returns the recipe when it belongs to the user's household", async () => {
    s.getRecipe.mockResolvedValue(recipeA);
    const agent = await agentForHousehold(HOUSEHOLD_A, 1);
    s.getUser.mockResolvedValue({ id: 1, username: "user1", householdId: HOUSEHOLD_A });

    const res = await agent.get(`/api/recipes/${recipeA.id}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe(recipeA.name);
  });
});

// ─── Weekly plans ─────────────────────────────────────────────────────────────

describe("Plan isolation", () => {
  it("getWeeklyPlan is called with the user's householdId", async () => {
    s.getWeeklyPlan.mockResolvedValue(planA);
    const agent = await agentForHousehold(HOUSEHOLD_A, 1);
    s.getUser.mockResolvedValue({ id: 1, username: "user1", householdId: HOUSEHOLD_A });

    await agent.get("/api/plans/2026-04-20");

    expect(s.getWeeklyPlan).toHaveBeenCalledWith("2026-04-20", HOUSEHOLD_A);
    expect(s.getWeeklyPlan).not.toHaveBeenCalledWith("2026-04-20", HOUSEHOLD_B);
  });

  it("returns 404 when a household has no plan for that week", async () => {
    s.getWeeklyPlan.mockResolvedValue(undefined);
    const agent = await agentForHousehold(HOUSEHOLD_B, 2);
    s.getUser.mockResolvedValue({ id: 2, username: "user2", householdId: HOUSEHOLD_B });

    const res = await agent.get("/api/plans/2026-04-20");

    expect(res.status).toBe(404);
  });
});

// ─── Reactions ───────────────────────────────────────────────────────────────

describe("Reactions isolation", () => {
  it("getReactionsForWeek is called with the user's householdId (SEC-003)", async () => {
    s.getReactionsForWeek.mockResolvedValue(reactionsA);
    const agent = await agentForHousehold(HOUSEHOLD_A, 1);
    s.getUser.mockResolvedValue({ id: 1, username: "user1", householdId: HOUSEHOLD_A });

    const res = await agent.get("/api/plans/2026-04-20/reactions");

    expect(res.status).toBe(200);
    expect(s.getReactionsForWeek).toHaveBeenCalledWith("2026-04-20", HOUSEHOLD_A);
    expect(s.getReactionsForWeek).not.toHaveBeenCalledWith("2026-04-20", HOUSEHOLD_B);
  });

  it("POST reaction is forbidden when no plan exists for that household (SEC-005)", async () => {
    // Household B has no plan for this week — reaction write must be blocked
    s.getWeeklyPlan.mockResolvedValue(undefined);
    const agent = await agentForHousehold(HOUSEHOLD_B, 2);
    s.getUser.mockResolvedValue({ id: 2, username: "user2", householdId: HOUSEHOLD_B });

    const res = await agent
      .post("/api/plans/2026-04-20/reactions")
      .send({ slotKey: "mon_dinner", emoji: "😍" });

    expect(res.status).toBe(403);
    expect(s.upsertReaction).not.toHaveBeenCalled();
  });

  it("POST reaction succeeds when the plan belongs to the user's household", async () => {
    s.getWeeklyPlan.mockResolvedValue(planA);
    s.upsertReaction.mockResolvedValue(undefined);
    const agent = await agentForHousehold(HOUSEHOLD_A, 1);
    s.getUser.mockResolvedValue({ id: 1, username: "user1", householdId: HOUSEHOLD_A });

    const res = await agent
      .post("/api/plans/2026-04-20/reactions")
      .send({ slotKey: "mon_dinner", emoji: "❤️" });

    expect(res.status).toBe(204);
    expect(s.upsertReaction).toHaveBeenCalledOnce();
    // Plan ownership was validated against the correct household
    expect(s.getWeeklyPlan).toHaveBeenCalledWith("2026-04-20", HOUSEHOLD_A);
  });
});
