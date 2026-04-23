import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { storage } from "../storage";
import { searchProducts } from "../services/openFoodFacts";
import { guessCategory } from "../utils/categorization";
import rateLimit from "express-rate-limit";

const router = Router();

const searchRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: { error: "Too many searches. Slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Product Search (Open Food Facts) ─────────────────────────────────────────

router.get("/products/search", requireAuth, searchRateLimit, async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json([]);
    const results = await searchProducts(q);
    res.json(results);
  } catch (err) { next(err); }
});

// ── Snack Wishlist ────────────────────────────────────────────────────────────

router.get("/wishlist", requireAuth, async (req, res, next) => {
  try {
    const householdId = (req.user as any).householdId;
    const items = await storage.getSnackWishlist(householdId);
    res.json(items);
  } catch (err) { next(err); }
});

router.post("/wishlist", requireAuth, async (req, res, next) => {
  try {
    const { name, brand, notes, imageUrl, productData } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Name required" });
    const householdId = (req.user as any).householdId;
    const userId = (req.user as any).id;
    const item = await storage.addSnackWishlistItem(householdId, userId, {
      name: name.trim(), brand, notes, imageUrl, productData,
    });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

router.delete("/wishlist/:id", requireAuth, async (req, res, next) => {
  try {
    const householdId = (req.user as any).householdId;
    await storage.deleteSnackWishlistItem(Number(req.params.id), householdId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Move wishlist item → shopping list
router.post("/wishlist/:id/add-to-shopping", requireAuth, async (req, res, next) => {
  try {
    const householdId = (req.user as any).householdId;
    const userId = (req.user as any).id;
    const wishlist = await storage.getSnackWishlist(householdId);
    const item = wishlist.find(w => w.id === Number(req.params.id));
    if (!item) return res.status(404).json({ error: "Item not found" });
    const added = await storage.addShoppingItem(householdId, userId, {
      name: item.name,
      category: "snacks",
      source: "wishlist",
      sourceId: item.id,
      productData: item.productData ?? undefined,
    });
    res.json(added);
  } catch (err) { next(err); }
});

// ── Persistent Shopping List ─────────────────────────────────────────────────

router.get("/shopping", requireAuth, async (req, res, next) => {
  try {
    const householdId = (req.user as any).householdId;
    const items = await storage.getShoppingList(householdId);
    res.json(items);
  } catch (err) { next(err); }
});

router.post("/shopping", requireAuth, async (req, res, next) => {
  try {
    const householdId = (req.user as any).householdId;
    const userId = (req.user as any).id;
    const { name, amount, unit, category, source, sourceId, productData } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Name required" });
    const cat = category ?? guessCategory(name);
    const item = await storage.addShoppingItem(householdId, userId, {
      name: name.trim(), amount, unit, category: cat, source, sourceId, productData,
    });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

// Bulk-add items (from recipe generation)
router.post("/shopping/bulk", requireAuth, async (req, res, next) => {
  try {
    const householdId = (req.user as any).householdId;
    const userId = (req.user as any).id;
    const { items } = req.body as { items: { name: string; amount?: string; unit?: string; category?: string; source?: string; sourceId?: number }[] };
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items array required" });
    const enriched = items.map(i => ({ ...i, category: i.category ?? guessCategory(i.name) }));
    const added = await storage.bulkAddShoppingItems(householdId, userId, enriched);
    res.status(201).json(added);
  } catch (err) { next(err); }
});

router.patch("/shopping/:id", requireAuth, async (req, res, next) => {
  try {
    const householdId = (req.user as any).householdId;
    const userId = (req.user as any).id;
    const { checked } = req.body;
    if (typeof checked !== "boolean") return res.status(400).json({ error: "checked boolean required" });
    const item = await storage.toggleShoppingItem(Number(req.params.id), householdId, userId, checked);
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json(item);
  } catch (err) { next(err); }
});

router.delete("/shopping/:id", requireAuth, async (req, res, next) => {
  try {
    await storage.deleteShoppingItem(Number(req.params.id), (req.user as any).householdId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete("/shopping", requireAuth, async (req, res, next) => {
  try {
    const householdId = (req.user as any).householdId;
    const { checked } = req.query;
    if (checked === "true") {
      await storage.clearCheckedShoppingItems(householdId);
    } else {
      await storage.clearAllShoppingItems(householdId);
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Attach product data to a shopping item (after user picks a product match)
router.patch("/shopping/:id/product", requireAuth, async (req, res, next) => {
  try {
    const householdId = (req.user as any).householdId;
    const { productData, imageUrl } = req.body;
    if (!productData) return res.status(400).json({ error: "productData required" });
    await storage.updateShoppingItemProduct(Number(req.params.id), householdId, productData, imageUrl);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
