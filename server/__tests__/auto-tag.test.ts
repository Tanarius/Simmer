/**
 * detectTags unit tests — pure function, no mocks, no HTTP.
 *
 * Verifies title-based tag detection and time-based tag detection.
 * Two call sites (routes.ts URL import, routes/ai.ts Spoonacular save)
 * now share this function, so regressions here affect both paths.
 */

import { describe, it, expect } from "vitest";
import { detectTags } from "../utils/autoTag";

// ─── Table-driven tests ───────────────────────────────────────────────────────

describe("detectTags — title keywords", () => {
  it('"Crock Pot Chicken Soup" → crockpot', () => {
    expect(detectTags("Crock Pot Chicken Soup", 0)).toContain("crockpot");
  });

  it('"Slow Cooker Beef Stew" → crockpot', () => {
    expect(detectTags("Slow Cooker Beef Stew", 0)).toContain("crockpot");
  });

  it('"Instant Pot Chili" → quick + one-pot', () => {
    const tags = detectTags("Instant Pot Chili", 0);
    expect(tags).toContain("quick");
    expect(tags).toContain("one-pot");
  });

  it('"Pressure Cooker Ribs" → quick + one-pot', () => {
    const tags = detectTags("Pressure Cooker Ribs", 0);
    expect(tags).toContain("quick");
    expect(tags).toContain("one-pot");
  });

  it('"Air Fryer Wings" → quick', () => {
    expect(detectTags("Air Fryer Wings", 0)).toContain("quick");
  });

  it('"Grilled Salmon" → grilled', () => {
    expect(detectTags("Grilled Salmon", 0)).toContain("grilled");
  });

  it('"BBQ Ribs" → grilled', () => {
    expect(detectTags("BBQ Ribs", 0)).toContain("grilled");
  });

  it('"Barbecue Chicken" → grilled', () => {
    expect(detectTags("Barbecue Chicken", 0)).toContain("grilled");
  });

  it('"One Pot Pasta" → one-pot', () => {
    expect(detectTags("One Pot Pasta", 0)).toContain("one-pot");
  });

  it('"Sheet Pan Salmon" → one-pot', () => {
    expect(detectTags("Sheet Pan Salmon", 0)).toContain("one-pot");
  });
});

// ─── Time-based tags ──────────────────────────────────────────────────────────

describe("detectTags — time-based detection", () => {
  it("30-minute meal → quick", () => {
    expect(detectTags("Pasta Primavera", 30)).toContain("quick");
  });

  it("29-minute meal → quick", () => {
    expect(detectTags("Stir Fry", 29)).toContain("quick");
  });

  it("31-minute meal → NOT quick", () => {
    expect(detectTags("Roast Chicken", 31)).not.toContain("quick");
  });

  it("0-minute meal → NOT quick (unknown time)", () => {
    expect(detectTags("Mystery Dish", 0)).not.toContain("quick");
  });

  it("240-minute meal → slow-cook", () => {
    expect(detectTags("Beef Stew", 240)).toContain("slow-cook");
  });

  it("300-minute meal → slow-cook", () => {
    expect(detectTags("Pulled Pork", 300)).toContain("slow-cook");
  });

  it("crockpot title + 240 min → crockpot but NOT slow-cook (crockpot takes priority)", () => {
    const tags = detectTags("Crock Pot Beef Stew", 300);
    expect(tags).toContain("crockpot");
    expect(tags).not.toContain("slow-cook");
  });
});

// ─── existingTags preservation ────────────────────────────────────────────────

describe("detectTags — existingTags preserved and deduplicated", () => {
  it("existing diet tags are kept", () => {
    const tags = detectTags("Pasta", 30, ["vegan", "gluten-free"]);
    expect(tags).toContain("vegan");
    expect(tags).toContain("gluten-free");
    expect(tags).toContain("quick");
  });

  it("no duplicates when title matches existing tag", () => {
    const tags = detectTags("Grilled Chicken", 0, ["grilled"]);
    expect(tags.filter(t => t === "grilled")).toHaveLength(1);
  });

  it("no duplicates when time matches existing quick tag", () => {
    const tags = detectTags("Instant Pot Soup", 25, ["quick"]);
    expect(tags.filter(t => t === "quick")).toHaveLength(1);
  });

  it("defaults to empty array when existingTags not provided", () => {
    expect(() => detectTags("Plain Chicken", 45)).not.toThrow();
    expect(detectTags("Plain Chicken", 45)).toEqual([]);
  });
});

// ─── Plain recipe — no tags ───────────────────────────────────────────────────

describe("detectTags — plain recipes produce no spurious tags", () => {
  it("simple baked chicken → no tags (60 min, no keywords)", () => {
    expect(detectTags("Baked Chicken", 60)).toEqual([]);
  });

  it("lasagna → no tags (90 min, no keywords)", () => {
    expect(detectTags("Classic Lasagna", 90)).toEqual([]);
  });
});
