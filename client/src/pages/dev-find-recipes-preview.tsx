// TEMPORARY — dev preview for the redesigned <FindRecipesPanel>.
// Renders the panel open with mock SpoonacularRecipe results (photo + placeholder,
// varied cuisines) so the layout can be eyeballed at desktop and mobile widths.
// Remove this page + its route in App.tsx before merging.
import { FindRecipesPanel, type SpoonacularRecipe } from "@/components/FindRecipesPanel";

// A tiny inline SVG "photo" so the image path renders without needing the network.
const fakePhoto = (hex: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='200'><rect width='320' height='200' fill='${hex}'/></svg>`
  )}`;

function mock(
  id: number,
  title: string,
  cuisines: string[],
  opts: Partial<SpoonacularRecipe> = {},
): SpoonacularRecipe {
  return {
    id,
    title,
    imageUrl: "",
    sourceUrl: "https://example.com/recipe",
    readyInMinutes: 30,
    servings: 4,
    summary: "",
    cuisines,
    dishTypes: [],
    diets: [],
    ingredients: [],
    instructions: [],
    ...opts,
  };
}

const MOCK_RECIPES: SpoonacularRecipe[] = [
  // ── With photo ──
  mock(1, "Spaghetti Carbonara with Pancetta", ["Italian"], {
    imageUrl: fakePhoto("#7a3b1d"), readyInMinutes: 25, servings: 2, diets: ["high protein"],
  }),
  mock(2, "Sheet-Pan Chicken Fajitas", ["Mexican"], {
    imageUrl: fakePhoto("#9a6212"), readyInMinutes: 35, servings: 4, diets: ["gluten free"],
  }),
  mock(3, "Miso Glazed Salmon Bowl", ["Japanese"], {
    imageUrl: fakePhoto("#0f5a47"), readyInMinutes: 20, servings: 2,
  }),
  // ── Placeholder (no photo) — varied cuisines to show color/glyph keying ──
  mock(4, "Classic American Cheeseburger Sliders", ["American"], {
    readyInMinutes: 40, servings: 6,
  }),
  mock(5, "Greek Lemon Chicken & Orzo", ["Greek"], {
    readyInMinutes: 45, servings: 4, diets: ["dairy free"],
  }),
  mock(6, "Butter Chicken with Basmati Rice", ["Indian"], {
    readyInMinutes: 50, servings: 4,
  }),
  mock(7, "Coq au Vin (French Braised Chicken)", ["French"], {
    readyInMinutes: 90, servings: 4,
  }),
  mock(8, "Pad Thai with Tofu", ["Thai"], {
    readyInMinutes: 25, servings: 3, diets: ["vegetarian"],
  }),
  // No cuisine at all → "other" placeholder
  mock(9, "Grandma's Mystery Casserole", [], {
    readyInMinutes: 60, servings: 8,
  }),
];

export default function DevFindRecipesPreview() {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="p-6 text-sm text-muted-foreground">
        TEMPORARY preview — <code>/dev/find-recipes-preview</code>. Resize the window to test
        the desktop modal (≥ md) vs. mobile bottom sheet (&lt; md).
      </div>
      <FindRecipesPanel open previewRecipes={MOCK_RECIPES} />
    </div>
  );
}
