import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { User } from "@shared/schema";

export const FREE_TIER_DAILY_LIMIT = 10;
// applies to: /api/ai/suggest, /api/ai/weekly-plan, /api/ai/optimize-shopping-list, /api/ai/clean-recipe/:id

export const TEST_TIER_DAILY_LIMIT = 200;
// applies to: test accounts (subscriptionTier = 'test')

export const COPILOT_FREE_TIER_DAILY_LIMIT = 30;
// applies to: /api/ai/copilot/chat only

export const COPILOT_TEST_TIER_DAILY_LIMIT = 200;
// applies to: test accounts copilot calls

export const ONBOARDING_DISH_LIMIT = 10;
// applies to: /api/onboarding/dishes only

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends User_ {}
  }
}
type User_ = import("@shared/schema").User;

// Premium sentinel returned to the client for callsRemaining (matches routes/ai.ts).
export const UNLIMITED = 9999;

// Charge the quota only once the response finishes successfully (2xx). Registering this on
// `finish` (rather than incrementing up front) means a failed handler — Anthropic error,
// timeout, validation 400, empty-response 422, 500 — never burns the user's daily quota.
// Guarded so a doubly-applied middleware (import-from-social lists aiRateLimit twice) charges
// exactly once. Fire-and-forget: the response is already sent; a rare charge failure just
// under-counts, which favours the user.
function chargeOnSuccess(res: Response, hookedFlag: string, charge: () => Promise<unknown>) {
  if ((res.locals as any)[hookedFlag]) return;
  (res.locals as any)[hookedFlag] = true;
  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      charge().catch(err => console.error("[rateLimit] quota charge failed:", err));
    }
  });
}

export async function aiRateLimit(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.isAuthenticated() || !req.user || !(req.user as any).id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = (req.user as any).id;
    await storage.resetAiCallsIfNewDay(userId);
    const usage = await storage.getUserAiUsage(userId);

    const isPremium = usage.subscriptionTier === 'premium';
    const limit = usage.subscriptionTier === 'test' ? TEST_TIER_DAILY_LIMIT : FREE_TIER_DAILY_LIMIT;
    if (!isPremium && usage.aiCallsToday >= limit) {
      // At the limit: reject up front. No charge — we return before hooking the response.
      return res.status(429).json({
        error: "Daily assistant limit reached",
        upgradePrompt: true,
        callsUsed: usage.aiCallsToday,
        callsLimit: limit
      });
    }

    // Remaining AFTER this (pending) call, so handlers surface an accurate count.
    res.locals.aiCallsRemaining = isPremium ? UNLIMITED : Math.max(0, limit - usage.aiCallsToday - 1);
    chargeOnSuccess(res, "__aiCharged", () => storage.incrementAiCalls(userId));
    next();
  } catch (error) {
    console.error("Rate limit check failed:", error);
    res.status(500).json({ error: "Failed to verify assistant usage limits" });
  }
}

export async function copilotRateLimit(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.isAuthenticated() || !req.user || !(req.user as any).id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = (req.user as any).id;
    await storage.resetCopilotCallsIfNewDay(userId);
    const usage = await storage.getUserAiUsage(userId);

    const isPremium = usage.subscriptionTier === 'premium';
    const copilotLimit = usage.subscriptionTier === 'test' ? COPILOT_TEST_TIER_DAILY_LIMIT : COPILOT_FREE_TIER_DAILY_LIMIT;
    if (!isPremium && usage.copilotCallsToday >= copilotLimit) {
      return res.status(429).json({
        error: "Daily Copilot chat limit reached",
        upgradePrompt: true,
        callsUsed: usage.copilotCallsToday,
        callsLimit: copilotLimit
      });
    }

    res.locals.copilotCallsRemaining = isPremium ? UNLIMITED : Math.max(0, copilotLimit - usage.copilotCallsToday - 1);
    chargeOnSuccess(res, "__copilotCharged", () => storage.incrementCopilotCalls(userId));
    next();
  } catch (error) {
    console.error("Copilot rate limit check failed:", error);
    res.status(500).json({ error: "Failed to verify Copilot usage limits" });
  }
}
