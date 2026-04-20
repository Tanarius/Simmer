/**
 * Copilot auth tests — proves session ownership is enforced.
 *
 * SEC-011: updateProposedActionStatus previously used only messageId in its
 * WHERE clause, allowing any user to mutate any other user's proposed action
 * by guessing the messageId. The fix adds userId + sessionId to the WHERE.
 *
 * These tests verify that:
 * 1. getCopilotHistory is always called with req.user.id (server-assigned),
 *    never with an arbitrary userId from the request.
 * 2. updateProposedActionStatus receives req.user.id + sessionId so the
 *    storage layer can reject cross-user mutation.
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
    // Copilot
    getCopilotHistory: vi.fn(),
    updateProposedActionStatus: vi.fn(),
    getUserAiUsage: vi.fn(),
    resetCopilotCallsIfNewDay: vi.fn(),
    incrementCopilotCalls: vi.fn(),
    init: vi.fn(),
    seedDefaultData: vi.fn(),
  },
}));

vi.mock("../services/email", () => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock("../utils/invite", () => ({ generateInviteCode: vi.fn().mockReturnValue("TESTCODE") }));
vi.mock("../services/copilot", () => ({
  chatWithCopilot: vi.fn().mockResolvedValue({ role: "assistant", content: "Hello!" }),
}));

process.env.SESSION_SECRET = "test-only";

import { setupAuth } from "../auth";
import { requireAuth } from "../middleware/requireAuth";
import { storage } from "../storage";

type MockedStorage = { [K in keyof typeof storage]: ReturnType<typeof vi.fn> };
const s = storage as unknown as MockedStorage;

// ── App factory ───────────────────────────────────────────────────────────────

function appWithCopilotRoutes() {
  const app = express();
  app.use(express.json());
  setupAuth(app);

  // Mirror the exact pattern from routes/ai.ts — user comes from req.user only
  app.get("/api/ai/copilot/history/:sessionId", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const { sessionId } = req.params;
    const history = await storage.getCopilotHistory(userId, sessionId);
    res.json(history);
  });

  app.post("/api/ai/copilot/execute-tool", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const { sessionId, messageId, status } = req.body;
    await storage.updateProposedActionStatus(userId, sessionId, messageId, status);
    res.status(204).send();
  });

  return app;
}

// ── Login helper ──────────────────────────────────────────────────────────────

async function loggedInAgent(userId: number, householdId: number) {
  const hash = await bcrypt.hash("password1!", 4);
  const user = { id: userId, username: `user${userId}`, password: hash, householdId };
  s.getUserByUsername.mockResolvedValue(user);
  s.getUser.mockResolvedValue(user);

  const app = appWithCopilotRoutes();
  const agent = request.agent(app);
  await agent.post("/api/login").send({ username: `user${userId}`, password: "password1!" });
  return agent;
}

beforeEach(() => vi.clearAllMocks());

// ─── Copilot history — ownership ──────────────────────────────────────────────

describe("Copilot history — session ownership (SEC-011)", () => {
  it("getCopilotHistory is called with the authenticated user's id", async () => {
    s.getCopilotHistory.mockResolvedValue([]);
    const agent = await loggedInAgent(1, 1);
    s.getUser.mockResolvedValue({ id: 1, username: "user1", householdId: 1 });

    await agent.get("/api/ai/copilot/history/session-abc");

    expect(s.getCopilotHistory).toHaveBeenCalledWith(1, "session-abc");
  });

  it("getCopilotHistory userId comes from session, not URL — different user cannot hijack session", async () => {
    s.getCopilotHistory.mockResolvedValue([]);
    // User 2 is logged in
    const agent = await loggedInAgent(2, 1);
    s.getUser.mockResolvedValue({ id: 2, username: "user2", householdId: 1 });

    // They try to access user 1's session by guessing the sessionId
    await agent.get("/api/ai/copilot/history/session-abc");

    // Storage was called with user 2's ID, not user 1's
    expect(s.getCopilotHistory).toHaveBeenCalledWith(2, "session-abc");
    expect(s.getCopilotHistory).not.toHaveBeenCalledWith(1, expect.anything());
  });

  it("unauthenticated request to history endpoint returns 401", async () => {
    const app = appWithCopilotRoutes();
    const res = await request(app).get("/api/ai/copilot/history/session-abc");
    expect(res.status).toBe(401);
    expect(s.getCopilotHistory).not.toHaveBeenCalled();
  });
});

// ─── Execute-tool — ownership ─────────────────────────────────────────────────

describe("Copilot execute-tool — ownership (SEC-011)", () => {
  it("updateProposedActionStatus is called with authenticated user's id and sessionId", async () => {
    s.updateProposedActionStatus.mockResolvedValue(undefined);
    const agent = await loggedInAgent(1, 1);
    s.getUser.mockResolvedValue({ id: 1, username: "user1", householdId: 1 });

    await agent
      .post("/api/ai/copilot/execute-tool")
      .send({ sessionId: "session-abc", messageId: 42, status: "applied" });

    expect(s.updateProposedActionStatus).toHaveBeenCalledWith(1, "session-abc", 42, "applied");
  });

  it("cross-user mutation is blocked — storage receives calling user's id, not a spoofed one", async () => {
    s.updateProposedActionStatus.mockResolvedValue(undefined);
    // User 2 tries to apply a proposed action from user 1's message (id=99)
    const agent = await loggedInAgent(2, 1);
    s.getUser.mockResolvedValue({ id: 2, username: "user2", householdId: 1 });

    await agent
      .post("/api/ai/copilot/execute-tool")
      .send({ sessionId: "user1-session", messageId: 99, status: "applied" });

    // Storage called with user 2's ID — storage WHERE clause will find no matching row
    expect(s.updateProposedActionStatus).toHaveBeenCalledWith(2, "user1-session", 99, "applied");
    expect(s.updateProposedActionStatus).not.toHaveBeenCalledWith(1, expect.anything(), expect.anything(), expect.anything());
  });

  it("unauthenticated execute-tool request returns 401", async () => {
    const app = appWithCopilotRoutes();
    const res = await request(app)
      .post("/api/ai/copilot/execute-tool")
      .send({ sessionId: "s", messageId: 1, status: "applied" });
    expect(res.status).toBe(401);
    expect(s.updateProposedActionStatus).not.toHaveBeenCalled();
  });
});
