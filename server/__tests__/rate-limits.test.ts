/**
 * Rate limit middleware unit tests — no HTTP, no database.
 *
 * Tests aiRateLimit and copilotRateLimit middleware directly using mock
 * req/res/next objects. Verifies:
 *  - Unauthenticated requests → 401
 *  - Free tier at limit → 429 with upgradePrompt:true
 *  - Free tier under limit → next() called, incrementAiCalls invoked
 *  - Test tier uses TEST_TIER_DAILY_LIMIT
 *  - Premium tier is never rate-limited regardless of call count
 *  - Storage error → 500
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../storage", () => ({
  storage: {
    resetAiCallsIfNewDay: vi.fn(),
    getUserAiUsage: vi.fn(),
    incrementAiCalls: vi.fn(),
    resetCopilotCallsIfNewDay: vi.fn(),
    incrementCopilotCalls: vi.fn(),
  },
}));

import { storage } from "../storage";
import {
  aiRateLimit,
  copilotRateLimit,
  FREE_TIER_DAILY_LIMIT,
  TEST_TIER_DAILY_LIMIT,
  COPILOT_FREE_TIER_DAILY_LIMIT,
  COPILOT_TEST_TIER_DAILY_LIMIT,
} from "../middleware/aiRateLimit";

type MockedStorage = { [K in keyof typeof storage]: ReturnType<typeof vi.fn> };
const s = storage as unknown as MockedStorage;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(authenticated: boolean, userId = 1) {
  return {
    isAuthenticated: () => authenticated,
    user: authenticated ? { id: userId } : undefined,
  } as any;
}

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as any;
}

function usageFor(tier: string, aiCallsToday: number, copilotCallsToday = 0) {
  return { subscriptionTier: tier, aiCallsToday, copilotCallsToday };
}

beforeEach(() => vi.clearAllMocks());

// ─── aiRateLimit ──────────────────────────────────────────────────────────────

describe("aiRateLimit", () => {
  it("unauthenticated request → 401, next not called", async () => {
    const req = makeReq(false);
    const res = makeRes();
    const next = vi.fn();

    await aiRateLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("free tier under limit → next() called, incrementAiCalls invoked", async () => {
    s.resetAiCallsIfNewDay.mockResolvedValue(undefined);
    s.getUserAiUsage.mockResolvedValue(usageFor("free", FREE_TIER_DAILY_LIMIT - 1));
    s.incrementAiCalls.mockResolvedValue(undefined);
    const req = makeReq(true, 1);
    const res = makeRes();
    const next = vi.fn();

    await aiRateLimit(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(s.incrementAiCalls).toHaveBeenCalledWith(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("free tier AT limit → 429 with upgradePrompt, next not called", async () => {
    s.resetAiCallsIfNewDay.mockResolvedValue(undefined);
    s.getUserAiUsage.mockResolvedValue(usageFor("free", FREE_TIER_DAILY_LIMIT));
    const req = makeReq(true, 1);
    const res = makeRes();
    const next = vi.fn();

    await aiRateLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    const body = res.json.mock.calls[0][0];
    expect(body.upgradePrompt).toBe(true);
    expect(body.callsLimit).toBe(FREE_TIER_DAILY_LIMIT);
    expect(next).not.toHaveBeenCalled();
  });

  it("free tier OVER limit → 429", async () => {
    s.resetAiCallsIfNewDay.mockResolvedValue(undefined);
    s.getUserAiUsage.mockResolvedValue(usageFor("free", FREE_TIER_DAILY_LIMIT + 5));
    const req = makeReq(true, 1);
    const res = makeRes();
    const next = vi.fn();

    await aiRateLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  it("test tier uses TEST_TIER_DAILY_LIMIT", async () => {
    s.resetAiCallsIfNewDay.mockResolvedValue(undefined);
    // At the higher test limit — should be blocked
    s.getUserAiUsage.mockResolvedValue(usageFor("test", TEST_TIER_DAILY_LIMIT));
    const req = makeReq(true, 1);
    const res = makeRes();
    const next = vi.fn();

    await aiRateLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json.mock.calls[0][0].callsLimit).toBe(TEST_TIER_DAILY_LIMIT);
    expect(next).not.toHaveBeenCalled();
  });

  it("test tier under TEST_TIER_DAILY_LIMIT → allowed", async () => {
    s.resetAiCallsIfNewDay.mockResolvedValue(undefined);
    s.getUserAiUsage.mockResolvedValue(usageFor("test", TEST_TIER_DAILY_LIMIT - 1));
    s.incrementAiCalls.mockResolvedValue(undefined);
    const req = makeReq(true, 1);
    const res = makeRes();
    const next = vi.fn();

    await aiRateLimit(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("premium tier is NEVER rate-limited regardless of call count", async () => {
    s.resetAiCallsIfNewDay.mockResolvedValue(undefined);
    s.getUserAiUsage.mockResolvedValue(usageFor("premium", 99999));
    s.incrementAiCalls.mockResolvedValue(undefined);
    const req = makeReq(true, 1);
    const res = makeRes();
    const next = vi.fn();

    await aiRateLimit(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("storage error → 500", async () => {
    s.resetAiCallsIfNewDay.mockRejectedValue(new Error("DB down"));
    const req = makeReq(true, 1);
    const res = makeRes();
    const next = vi.fn();

    await aiRateLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── copilotRateLimit ─────────────────────────────────────────────────────────

describe("copilotRateLimit", () => {
  it("unauthenticated request → 401", async () => {
    const req = makeReq(false);
    const res = makeRes();
    const next = vi.fn();

    await copilotRateLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("free tier under COPILOT_FREE_TIER_DAILY_LIMIT → allowed", async () => {
    s.resetCopilotCallsIfNewDay.mockResolvedValue(undefined);
    s.getUserAiUsage.mockResolvedValue(usageFor("free", 0, COPILOT_FREE_TIER_DAILY_LIMIT - 1));
    s.incrementCopilotCalls.mockResolvedValue(undefined);
    const req = makeReq(true, 1);
    const res = makeRes();
    const next = vi.fn();

    await copilotRateLimit(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(s.incrementCopilotCalls).toHaveBeenCalledWith(1);
  });

  it("free tier AT COPILOT_FREE_TIER_DAILY_LIMIT → 429 with upgradePrompt", async () => {
    s.resetCopilotCallsIfNewDay.mockResolvedValue(undefined);
    s.getUserAiUsage.mockResolvedValue(usageFor("free", 0, COPILOT_FREE_TIER_DAILY_LIMIT));
    const req = makeReq(true, 1);
    const res = makeRes();
    const next = vi.fn();

    await copilotRateLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    const body = res.json.mock.calls[0][0];
    expect(body.upgradePrompt).toBe(true);
    expect(body.callsLimit).toBe(COPILOT_FREE_TIER_DAILY_LIMIT);
    expect(next).not.toHaveBeenCalled();
  });

  it("test tier uses COPILOT_TEST_TIER_DAILY_LIMIT", async () => {
    s.resetCopilotCallsIfNewDay.mockResolvedValue(undefined);
    s.getUserAiUsage.mockResolvedValue(usageFor("test", 0, COPILOT_TEST_TIER_DAILY_LIMIT));
    const req = makeReq(true, 1);
    const res = makeRes();
    const next = vi.fn();

    await copilotRateLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json.mock.calls[0][0].callsLimit).toBe(COPILOT_TEST_TIER_DAILY_LIMIT);
  });

  it("premium tier bypasses copilot rate limit regardless of call count", async () => {
    s.resetCopilotCallsIfNewDay.mockResolvedValue(undefined);
    s.getUserAiUsage.mockResolvedValue(usageFor("premium", 0, 99999));
    s.incrementCopilotCalls.mockResolvedValue(undefined);
    const req = makeReq(true, 1);
    const res = makeRes();
    const next = vi.fn();

    await copilotRateLimit(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("storage error → 500", async () => {
    s.resetCopilotCallsIfNewDay.mockRejectedValue(new Error("DB down"));
    const req = makeReq(true, 1);
    const res = makeRes();
    const next = vi.fn();

    await copilotRateLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
