import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { User } from "@shared/schema";

export const FREE_TIER_DAILY_LIMIT = 5;

// Properly type req.user based on the schema
declare global {
  namespace Express {
    interface User extends import("@shared/schema").User {}
  }
}

export async function aiRateLimit(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.isAuthenticated() || !req.user || !req.user.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userId = req.user.id;

    // Reset if it's a new day
    await storage.resetAiCallsIfNewDay(userId);

    // Fetch current usage and tier
    const usage = await storage.getUserAiUsage(userId);

    // Limit check
    if (usage.subscriptionTier === 'free' && usage.aiCallsToday >= FREE_TIER_DAILY_LIMIT) {
      return res.status(429).json({
        error: "Daily AI limit reached",
        upgradePrompt: true,
        callsUsed: usage.aiCallsToday,
        callsLimit: FREE_TIER_DAILY_LIMIT
      });
    }

    // Still tracking premium users' calls for analytics, but not blocking them
    await storage.incrementAiCalls(userId);

    // Proceed
    next();
  } catch (error) {
    console.error("Rate limit check failed:", error);
    res.status(500).json({ error: "Failed to verify AI usage limits" });
  }
}
