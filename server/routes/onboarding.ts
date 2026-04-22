import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";

const router = Router();

router.get("/state", async (req, res, next) => {
  try {
    const state = await storage.getOnboardingState((req.user as any).id);
    res.json(state || { completed: false, currentStep: 1 });
  } catch (err) {
    next(err);
  }
});

router.post("/start", async (req, res, next) => {
  try {
    let state = await storage.getOnboardingState((req.user as any).id);
    if (!state) {
      state = await storage.createOnboardingState((req.user as any).id);
    }
    res.json(state);
  } catch (err) {
    next(err);
  }
});

router.post("/mode", async (req, res, next) => {
  try {
    const { cookingMode } = req.body;
    let state = await storage.getOnboardingState((req.user as any).id);
    if (!state) {
      await storage.createOnboardingState((req.user as any).id);
    }
    await storage.setOnboardingMode((req.user as any).id, cookingMode);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get("/dishes", async (req, res, next) => {
  try {
    // Return a curated variety of dishes to build the taste profile
    const dishes = [
      { id: 1, dishName: "Spicy Tuna Roll", cuisineType: "asian", complexity: "medium", mealType: "dinner", imageUrl: "https://images.unsplash.com/photo-1579584425555-c3ce17f6a08c?w=600&q=75&auto=format" },
      { id: 2, dishName: "Classic Cheeseburger", cuisineType: "american", complexity: "easy", mealType: "lunch", imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=75&auto=format" },
      { id: 3, dishName: "Chicken Tikka Masala", cuisineType: "indian", complexity: "hard", mealType: "dinner", imageUrl: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=75&auto=format" },
      { id: 4, dishName: "Avocado Toast", cuisineType: "american", complexity: "easy", mealType: "breakfast", imageUrl: "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=600&q=75&auto=format" },
      { id: 5, dishName: "Margherita Pizza", cuisineType: "italian", complexity: "medium", mealType: "dinner", imageUrl: "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=600&q=75&auto=format" },
      { id: 6, dishName: "Pad Thai", cuisineType: "asian", complexity: "medium", mealType: "dinner", imageUrl: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=600&q=75&auto=format" },
      { id: 7, dishName: "Beef Tacos", cuisineType: "tex-mex", complexity: "easy", mealType: "dinner", imageUrl: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&q=75&auto=format" },
      { id: 8, dishName: "Salmon Salad", cuisineType: "other", complexity: "easy", mealType: "lunch", imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&q=75&auto=format" },
      { id: 9, dishName: "Mushroom Risotto", cuisineType: "italian", complexity: "hard", mealType: "dinner", imageUrl: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=600&q=75&auto=format" },
      { id: 10, dishName: "Pancakes", cuisineType: "american", complexity: "easy", mealType: "breakfast", imageUrl: "https://images.unsplash.com/photo-1528207776546-3820a4b73bd3?w=600&q=75&auto=format" }
    ];
    res.json(dishes);
  } catch (err) {
    next(err);
  }
});

router.post("/swipe", async (req, res, next) => {
  try {
    const { dishName, cuisineType, complexity, mealType, liked, imageUrl } = req.body;
    await storage.saveOnboardingSwipe((req.user as any).id, { dishName, cuisineType, complexity, mealType, liked, imageUrl });
    
    // Update the taste profile incrementally
    if (liked) {
      await storage.incrementCuisineSignal((req.user as any).id, cuisineType);
    }
    
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// New onboarding v2 — saves all preferences in one shot
router.post("/preferences", async (req, res, next) => {
  try {
    const userId = (req.user as any).id;
    const { householdSize, cookingStyles, cuisines, dietary } = req.body;

    // Ensure onboarding record exists
    const state = await storage.getOnboardingState(userId);
    if (!state) await storage.createOnboardingState(userId);

    // Derive complexity from cooking style
    const complexity = cookingStyles?.includes('quick') ? 'easy'
      : cookingStyles?.includes('classic') ? 'medium' : 'medium';

    await Promise.all([
      storage.upsertUserPreferences(userId, {
        cookingStyles: cookingStyles ?? [],
        cuisines: cuisines ?? [],
        dietary: (dietary ?? []).filter((d: string) => d !== 'none'),
        householdSize: householdSize ?? 2,
      }),
      storage.upsertUserTasteProfile(userId, {
        cookingMode: 'cook',
        likedCuisines: cuisines ?? [],
        complexityPreference: complexity,
        cuisineSignals: Object.fromEntries((cuisines ?? []).map((c: string) => [c, 2])),
        derivedFrom: 0,
      }),
      storage.completeOnboarding(userId),
    ]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/complete", async (req, res, next) => {
  try {
    const userId = (req.user as any).id;
    await storage.completeOnboarding(userId);

    // Derive and persist the taste profile from all swipes collected during onboarding
    const swipes = await storage.getOnboardingSwipes(userId);
    const cuisineSignals: Record<string, number> = {};
    const likedCuisines: string[] = [];
    const dislikedCuisines: string[] = [];
    const complexityCounts: Record<string, number> = {};

    for (const swipe of swipes) {
      if (swipe.liked) {
        cuisineSignals[swipe.cuisineType] = (cuisineSignals[swipe.cuisineType] || 0) + 1;
        if (!likedCuisines.includes(swipe.cuisineType)) likedCuisines.push(swipe.cuisineType);
        complexityCounts[swipe.complexity] = (complexityCounts[swipe.complexity] || 0) + 1;
      } else {
        if (!dislikedCuisines.includes(swipe.cuisineType)) dislikedCuisines.push(swipe.cuisineType);
      }
    }

    // Complexity: take the most-liked complexity level; default medium
    const complexityPref = Object.entries(complexityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'medium';
    // Don't mark a cuisine as disliked if they also liked it somewhere
    const finalDisliked = dislikedCuisines.filter(c => !likedCuisines.includes(c));

    const state = await storage.getOnboardingState(userId);
    await storage.upsertUserTasteProfile(userId, {
      cookingMode: (state?.cookingMode as any) || 'eater',
      likedCuisines,
      dislikedCuisines: finalDisliked,
      complexityPreference: complexityPref,
      cuisineSignals,
      derivedFrom: swipes.length,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
