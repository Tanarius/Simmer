# Simmer — Claude Code Project Guide

This file is loaded automatically at the start of every session. Keep it current to avoid wasting tokens re-exploring the codebase.

---

## Current State — June 2026

### Brand
- App name: **Simmer** — tagline: "Good things simmer."
- Primary: `#C96A3A` (terracotta), Secondary: `#3D5A47` (forest green)
- Dark bg: `#1C1410`, Surface: `#2A1F18`
- Logo: "S" placeholder in sidebar — awaiting SVG from Midjourney
- Favicon: `client/public/favicon.ico` — needs real logo

### Deployment
- Platform: Railway — URL: `https://mealprep-production-61e1.up.railway.app`
- All env vars confirmed set in Railway dashboard
- Auto-deploys on `git push` to `main`

### Test Account
- Username: `simmer_test` / Password: `SimmTest2026!` / HouseholdId: 6
- Has 12 seeded recipes, full weekly plan, 62 shopping items

### Feature Status
| Feature | Status |
|---|---|
| Auth (login, register, password reset) | Complete |
| Recipe CRUD + URL import + social import | Complete |
| Weekly planner (drag-and-drop, slot swap) | Complete |
| Shopping list + Copilot input bar | Complete |
| Pantry staples | Complete |
| Find Recipes (free text + 5 filter chip rows) | Complete — 3 active bugs (see below) |
| Kitchen Copilot | Complete with tool use |
| Chef Mode (AI suggest from pantry) | Complete |
| Household sharing | Complete |
| Stripe billing | Wired, test mode (not yet live keys) |
| Onboarding | Complete |

### Active Bugs — Find Recipes (`client/src/components/CopilotPanel.tsx`)
1. **Suggested query chip** populates text input but doesn't fire search — must trigger search immediately on click.
2. **Text-parsed cuisine** doesn't highlight the correct cuisine chip — typing "american" should activate the American chip visually.
3. **Search button** may not read the current input value correctly when fired after a chip click.

Fix all three before any other work.

### Pre-Launch Checklist
1. Fix Find Recipes bugs above
2. Logo SVG → real favicon (waiting on Midjourney)
3. Landing page
4. Sentry error monitoring
5. Smoke test full new-user flow

### Audit Status
All critical and important pre-launch audit items resolved. 394/394 tests passing. TSC clean.

### Claude + Claude Code Workflow
- Claude (claude.ai): strategy, prompts, browser testing, product decisions, audit review
- Claude Code: implementation, file changes, tests
- User pastes prompts from Claude into Claude Code; update CLAUDE.md after every major session.

---

## Stack

- **Frontend**: React + Vite, TailwindCSS, shadcn/ui, TanStack Query, Wouter routing (hash-based: `/#/`, `/#/recipes`, etc.)
- **Backend**: Express 5 + TypeScript (tsx), Passport.js (local strategy), connect-pg-simple sessions (PostgreSQL-backed)
- **Database**: PostgreSQL via Neon — Drizzle ORM, schema in `shared/schema.ts`
- **AI**: Anthropic Claude (`server/services/anthropic.ts`), Kitchen Copilot (`server/services/copilot.ts`)
- **Recipe APIs**: Spoonacular (`server/services/spoonacular.ts`) + Edamam (`server/services/edamam.ts`) + TheMealDB (always-on parallel source)
- **Billing**: Stripe (test mode) — not yet live keys
- **Email**: Resend — password reset tokens
- **Deployment**: Railway — `https://mealprep-production-61e1.up.railway.app`

---

## Key Environment Variables

```
ANTHROPIC_API_KEY       # Claude AI — required
DATABASE_URL            # Neon PostgreSQL — required
SESSION_SECRET          # Express session — required
SPOONACULAR_API_KEY     # Recipe search + URL import — 365k recipes (free tier, ~50pts/extract)
EDAMAM_APP_ID           # Recipe search — 2.3M recipes (PAID, ~$29/mo — Recipe Search API is not free)
EDAMAM_APP_KEY          # Recipe search — only activate if you have a paid Edamam plan
```

---

## Architecture

### Auth (`server/auth.ts`)
- Passport local strategy, **bcrypt (cost 12)** — legacy plaintext accounts auto-upgraded on next login
- **`safeUser()`** strips password before every `res.json()` — never return password to client
- Sessions in **PostgreSQL (connect-pg-simple)** — survive server restarts
- Rate limits: free=5 AI calls/day, 20 copilot/day; test tier=50 each; premium=unlimited
- Password reset via Resend email — 15-min token, stored hashed in DB

### Routes
- `server/routes.ts` — all non-AI routes: recipes CRUD, shopping list, weekly plans, pantry, URL import
- `server/routes/ai.ts` — AI routes under `/api/ai/`: copilot chat, find-recipes, save-recipe, clean-recipe, suggest, weekly-plan
- `server/routes/onboarding.ts` — onboarding flow
- `server/routes/snacks.ts` — snack wishlist + persistent shopping list (product search, bulk add, toggle, clear)

### Pages & Routing
- `/` → `HomePage` (dashboard: today's meals, activity feed, shopping nudge)
- `/recipes` → `RecipesPage` (full recipe library with dialog, copilot panel)
- `/planner` → `PlannerPage` (weekly drag-and-drop meal planner)
- `/shopping`, `/pantry`, `/profile`, `/auth`, `/onboarding`

### Data Model (key tables)
- `recipes` — ingredients stored as JSON text: `[{name, amount, unit, category}]`; instructions as JSON text: `["step 1", "step 2"]`
- `weeklyPlans` — meals stored as JSON: `{mon_lunch: recipeId, mon_dinner: recipeId, ...}`, keyed by `weekStart` (ISO Monday date). Also has `meal_meta TEXT` column (JSON: `{mon_lunch: {addedBy: "Allie"}, notes: {mon: "pizza night"}}`)
- `meal_reactions` — per-user emoji reactions on plan slots: `(weekStart, slotKey, userId, emoji)` with unique constraint. DB table exists, schema.ts type + storage methods + routes not yet wired.
- `userTasteProfile` — `dislikedIngredients[]`, `ingredientSubstitutions{}`, `likedCuisines[]`, `complexityPreference`
- `copilotSessions` — chat history per sessionId per user
- `activityLog` — `(userId, action, recipeId, recipeName, createdAt)` — actions: recipe_added, recipe_deleted, plan_updated, plan_meal_added, pantry_added
- `users` — has `avatar TEXT` column (Dicebear style key, nullable). Set via `PATCH /api/auth/avatar`, read by `getHouseholdMembers`.

### Recipe Categorization (`server/utils/categorization.ts: guessCategory()`)
- Always re-run `guessCategory(name)` at shopping list generation time — never trust stored `ing.category`
- Pantry/spices checked BEFORE produce to prevent "garlic powder" → produce
- Order: protein → frozen → bakery → grains → dairy → condiments → pantry → produce
- `guessCuisine(title, ingredients[])` is the single shared cuisine function — **do not duplicate inline** (was fixed in session)

### Social Media Import (`POST /api/ai/import-from-social`)
- Two modes: `text` (paste caption) → haiku; `image` (screenshot upload) → sonnet-4-6 vision
- Returns same shape as URL import — frontend uses shared `populateFromImport()` helper
- 4 MB image size guard; strips data URL prefix automatically
- Rate-limited via `aiRateLimit` middleware

### URL Recipe Import (`POST /api/recipes/import-url`)
Two-strategy pipeline in `server/routes.ts`:
1. **Strategy 1 — Direct fetch + JSON-LD/HTML parse**: Works for most recipe blogs (Serious Eats, Simply Recipes, NYT Cooking, etc.) that serve server-rendered HTML. `fetchHtml()` sends clean browser headers (no `Accept-Encoding: br`, no `Sec-Fetch-*` headers — those caused issues).
2. **Strategy 2 — Spoonacular extract API** (`extractRecipeByUrl()` in `server/services/spoonacular.ts`): Handles Cloudflare-protected sites (AllRecipes, Food Network, Tasty, Delish, Bon Appétit). ~50 Spoonacular points per call. Returns full `SpoonacularRecipe` shape.
- **Wayback Machine was removed** — archive.org now returns 402 "Payment Required" from Node.js fetch and the availability API takes 10+ seconds. Do not re-add it.
- **Foodista is permanently broken** for URL import — fully client-side rendered (Next.js App Router), no server-rendered data. Users should delete Foodista recipes and use text-paste import instead.
- Auto-clean fires after save: if instructions are placeholder/empty, Claude re-fetches + generates steps from ingredients.

### Copilot Recipe Search (`server/services/spoonacular.ts: searchRecipesForCopilot()`)
- First search: Spoonacular + **TheMealDB** + Edamam in parallel via `Promise.allSettled`, interleaved in priority order: spoon > mealdb > edamam
- "Find different" (`attempt > 0`): random Spoonacular + **TheMealDB** + Edamam parallel, same priority interleave
- TheMealDB is always-on (free, no key needed, full instructions) — no longer just a last-resort fallback
- 5-level fallback cascade if Spoonacular returns < 3: relax time → drop type → drop protein → drop cuisine → Edamam only → TheMealDB
- Edamam results have **no step-by-step instructions** (API limitation) — a single "see source link" step is injected so saved recipes aren't completely blank
- `protein=sides` is treated as a mealType override, not an ingredient filter
- `type=snack` avoided in Spoonacular (nearly empty); uses `query=snack + maxReadyTime=20` instead

### Shopping List (`client/src/pages/shopping.tsx`)
- **Auto-sync**: Full reconciliation on every plan change — deletes all `source="recipe"` items, re-adds from current plan. Triggered by plan hash change (localStorage key: `shopping-synced-{weekStart}-{planHash}`). Does NOT poll — mutation-based invalidation only.
- **Manual sync button**: Same reconciliation logic, also resets the sync key so it re-runs.
- **Layout**: CSS `columns-2` with `break-inside-avoid` — true newspaper-column masonry, not CSS grid.
- `DELETE /api/snacks/shopping?source=recipe` — clears only recipe-sourced items (not manual adds).

### Avatar System (`client/src/components/DicebearAvatar.tsx`)
- 8 Dicebear styles: `adventurer`, `lorelei`, `bottts`, `micah`, `funEmoji`, `pixelArt`, `rings`, `thumbs`
- Falls back to gradient initials if `avatarStyle` is null/undefined
- Used in: profile page (camera picker), app sidebar (user row), activity feed (per-entry avatar)
- `getRecentActivity()` now returns `avatar: string | null` alongside `username` — activity feed uses it

### Weekly Planner (`client/src/pages/planner.tsx`)
- Drag library: `@dnd-kit/core` + `@dnd-kit/utilities`
- **Slot-to-slot drag**: Filled meal cards are now draggable (not just sidebar recipes). `useDraggable` + `useDroppable` combined on the same div using inline ref callback `ref={node => { setDropRef(node); setDragRef(node); }}`. Data carries `{ fromSlot: slotKey }` to distinguish from sidebar drags.
- **Move vs swap**: If dragging to empty slot → moves and clears source. If dragging to filled slot → swaps both recipes.
- `handleDragStart` looks up recipe from `currentMeals[fromSlot]` for the ghost overlay.
- Sensors: `PointerSensor { distance: 5 }`, `TouchSensor { delay: 200, tolerance: 5 }` — quick tap still fires onClick for mobile picker.

---

## Frontend Patterns

### TanStack Query
- All queries use path-based keys: `["/api/recipes"]`, `["/api/plans", weekStart]`
- After mutations, invalidate with `queryClient.invalidateQueries({ queryKey: ["/api/recipes"] })`
- Recipe dialog uses `selectedRecipeId` (not full object) so live query data auto-updates after clean
- Activity feed polls every 60s (was 30s, reduced for efficiency)
- Home page activity/shopping polls every 120s (was 30s)
- Shopping list does NOT auto-poll — updates via mutation invalidation only (was 20s)

### Opening a Recipe Dialog from Any Page
```tsx
// From any page (home, planner, activity feed):
sessionStorage.setItem("openRecipeId", String(id));
setLocation("/recipes");
// The recipes page reads sessionStorage on mount and opens the dialog.

// If ALREADY on /recipes:
window.dispatchEvent(new CustomEvent("openRecipe", { detail: { recipeId: id } }));
```
- `RecipeHoverPreview` in `ActivityFeed.tsx` checks `window.location.hash.startsWith("#/recipes")` — if yes, fires event; otherwise sessionStorage + navigate to `/recipes` (not `/`).
- Home page Cook button uses the same pattern (`setLocation("/recipes")`).

### Shared Utilities
- `client/src/lib/ingredientCategories.ts` — `categorizeIngredient()`, `getIngredientChipClass()`, `groupIngredientsByCategory()`
- `client/src/lib/format-time.ts` — `formatTimeBreakdown(prep, cook)`
- `client/src/components/DicebearAvatar.tsx` — shared avatar component, accepts `username`, `avatarStyle`, `size`, `className`

### Copilot Panel (`client/src/components/CopilotPanel.tsx`)
- Right drawer on desktop, bottom sheet on mobile
- When `hasResults`: questions collapse to compact summary chip row (saves scroll)
- Taste profile dots on cuisine options derived from cached `/api/recipes` — no extra fetch
- Protein step is optional (step 4) — `readyToSearch` only requires meal + cuisine + vibe

---

## Cuisine & Tag System (as of 2026-04-25)

### Cuisines (7 values)
`tex-mex`, `italian`, `asian`, `american`, `mediterranean`, `indian`, `other`
- UI colors: orange, red, emerald, blue, cyan, yellow, purple
- `guessCuisine(title, ingredients[])` in `server/utils/categorization.ts` — the SINGLE shared function
- Copilot save-recipe (`server/routes/ai.ts`) imports and uses `guessCuisine` — the old inline `normalizeCuisine` was removed

### Tags (auto-detected on save)
`crockpot`, `slow-cook`, `grilled`, `quick`, `make-ahead`, `freezer-friendly`, `one-pot`, `one-pan`, `air-fryer`
- Auto-tag logic runs in both `server/routes.ts` (URL import) and `server/routes/ai.ts` (Spoonacular save)
- Detect from title keywords: crock.?pot → crockpot; air.?fry → air-fryer; grill|bbq → grilled
- Detect from cook time: ≤30min → quick; ≥240min + not crockpot → slow-cook
- Tags saved from Spoonacular are diets array merged with auto-detected method tags

---

## Performance & Resource Management (as of 2026-04-25)

- **Cache TTL eviction**: `server/utils/cache.ts` runs `evictExpired()` every 10 min via `setInterval(...).unref()` — no longer grows unbounded
- **Shopping list query**: `POST /api/shopping-list` uses `storage.getRecipesByIds(ids, householdId)` — single batch `inArray` query, was N+1 loop
- **Rate limiting**: `POST /api/ai/copilot/save-recipe` now has `copilotRateLimit` — was completely unguarded
- **Polling intervals**: activity feed 60s, home page 120s, shopping list off (mutation-only)

---

## Known Issues / Tech Debt (as of 2026-06-03)

### Security (open, non-blocking)
- SEC-010: No CSRF tokens — deferred post-launch. SameSite=Lax on session cookie partially mitigates.

### Data Quality
- Duplicate near-identical ingredient names in shopping list ("boneless skinless" vs "boneless, skinless") — needs fuzzy dedup
- Some recipe ingredients have instruction text baked into the name (e.g. "to 6 cups prepared mashed potatoes (see notes)")
- Onboarding dish thumbnails broken (bad seed image URLs)

### Performance
- Spoonacular `fillIngredients: true` costs extra quota points — already set to `false`, confirmed in audit

---

## Development

```bash
npm run dev        # starts Express + Vite HMR on port 5000
npx tsc --noEmit   # type check (target ES2020 — required for gis regex flag)
npm test           # run test suite (vitest, no DB/API keys needed)
npm run test:watch # watch mode during development
```

Server changes require a manual restart (tsx doesn't watch by default in this setup). Kill with `npx kill-port 5000 && npm run dev`.

---

## Security & Testing Docs

Full living documents — read these before touching auth, routes, or storage:

- **`docs/SECURITY_AUDIT.md`** — every security finding, fix, commit reference, and open item. Update this whenever a security change is made.
- **`docs/TESTING.md`** — test philosophy, coverage map (what's tested / what's not), and the roadmap for Tier 2–4 tests.

### Security rules (non-negotiable)
- `householdId` always comes from `req.user.householdId` — never from request body or params.
- Every route that touches user data must use `requireAuth` middleware, not inline `if (!req.user)` checks. (SEC-009 fixed: all 5 household routes migrated in session 2026-04-24)
- Plaintext password comparison lives ONLY in the login migration path (`server/auth.ts:78`). Do not add it anywhere else.
- After any security fix, add a test that would have caught the original bug and update `docs/SECURITY_AUDIT.md`.

### Test rules
- `npm test && npx tsc --noEmit` must both pass before every commit.
- New test files go in `server/__tests__/` (backend) or `client/src/__tests__/` (frontend).
- Mock all external services — no real DB, API keys, or network calls in tests.
- After adding tests, update the coverage map in `docs/TESTING.md`.

---

## What NOT to do

- Don't use `res.json(req.user)` directly — always use `safeUser(req.user)`
- Don't trust `ing.category` from stored recipe data — re-run `guessCategory(name)`
- Don't add `type=snack` to Spoonacular params — nearly empty, use query text instead
- Don't call `useMemo` after an early return in React components — hooks violation
- Don't use `element.click()` to trigger React state — use React synthetic events or `nativeInputValueSetter`
- Don't add inline `normalizeCuisine` functions — use shared `guessCuisine` from `server/utils/categorization.ts`
- Don't use Wayback Machine (archive.org) for URL import fallback — returns 402 from Node.js, availability API takes 10+ seconds. Use Spoonacular extract instead.
- Don't navigate to `/` to open a recipe — `/` is the home page (dashboard), `/recipes` is the recipe library. Always use `setLocation("/recipes")` + sessionStorage.
- Don't send `Sec-Fetch-*` or `Accept-Encoding: gzip, deflate, br` headers in server-side `fetch()` calls — can cause decompression issues and trigger bot detection on third-party APIs.

---

## Token Efficiency Laws

These are mandatory, not suggestions. Follow them every session.

### 1. Sub-agents absorb exploration cost
- Any task requiring > 2 unknown file locations → launch an **Explore** sub-agent with a specific question, get the answer back, act on it. Never explore in main context.
- Research, "find where X is implemented", "how does Y work" → sub-agent. Main context only receives the answer.
- Large file reads needed only for understanding (not editing) → sub-agent reads it, summarizes relevant parts.

### 2. Screenshots replace file reads for UI verification
- After editing a frontend file, take a **targeted Puppeteer screenshot** instead of reading the file back to verify.
- Use `selector` param to screenshot a specific component, not the whole page — smaller image = fewer tokens.
- One screenshot to confirm a visual change costs far less than re-reading a 300-line component.

### 3. Read only what you're about to edit
- Never read a file "to understand the codebase" in main context — use Explore sub-agent.
- When editing, use `offset` + `limit` to read only the relevant section, not the whole file.
- Use `Grep` with a specific pattern to find the exact lines before reading context around them.

### 4. Never read a file twice in the same session
- If a file was read earlier in the conversation, reference that result — don't re-read.
- The system reminder notes recently-read files. Check it before issuing a Read.

### 5. Keep Grep results tight
- Always set `head_limit` on Grep — default 250 is often too many. Use 20–30 for targeted searches.
- Use `output_mode: "files_with_matches"` first to locate, then `content` only on the specific file.

### 6. Parallel tool calls everywhere
- Whenever two reads/searches are independent, issue them in the same message as parallel calls.
- Never do sequential reads that could be parallel — it doubles round-trips for no gain.

### 7. TypeScript check before screenshots
- Run `npx tsc --noEmit` after edits. A compile error costs nothing to catch early; a broken UI screenshot wastes tokens and a server restart.

### 8. CLAUDE.md is the source of truth
- Before asking "how does X work here", check CLAUDE.md first.
- After fixing a non-obvious bug or establishing a new pattern, update CLAUDE.md immediately.
- Memory files (`~/.claude/.../memory/`) are for user preferences and bug tracker only — not architecture.
