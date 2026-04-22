# MealPrep — Claude Code Project Guide

This file is loaded automatically at the start of every session. Keep it current to avoid wasting tokens re-exploring the codebase.

---

## Stack

- **Frontend**: React + Vite, TailwindCSS, shadcn/ui, TanStack Query, Wouter routing
- **Backend**: Express + TypeScript (tsx), Passport.js (local strategy), express-session (MemoryStore)
- **Database**: PostgreSQL via Neon — Drizzle ORM, schema in `shared/schema.ts`
- **AI**: Anthropic Claude (`server/services/anthropic.ts`), Kitchen Copilot (`server/services/copilot.ts`)
- **Recipe APIs**: Spoonacular (`server/services/spoonacular.ts`) + Edamam (`server/services/edamam.ts`) + TheMealDB (free fallback)
- **Deployment**: Railway (previously Render)

---

## Key Environment Variables

```
ANTHROPIC_API_KEY       # Claude AI — required
DATABASE_URL            # Neon PostgreSQL — required
SESSION_SECRET          # Express session — required
SPOONACULAR_API_KEY     # Recipe search — 365k recipes (free tier)
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

### Data Model (key tables)
- `recipes` — ingredients stored as JSON text: `[{name, amount, unit, category}]`; instructions as JSON text: `["step 1", "step 2"]`
- `weeklyPlans` — meals stored as JSON: `{mon_lunch: recipeId, mon_dinner: recipeId, ...}`, keyed by `weekStart` (ISO Monday date). Also has `meal_meta TEXT` column (JSON: `{mon_lunch: {addedBy: "Allie"}, notes: {mon: "pizza night"}}`)
- `meal_reactions` — per-user emoji reactions on plan slots: `(weekStart, slotKey, userId, emoji)` with unique constraint. DB table exists, schema.ts type + storage methods + routes not yet wired.
- `userTasteProfile` — `dislikedIngredients[]`, `ingredientSubstitutions{}`, `likedCuisines[]`, `complexityPreference`
- `copilotSessions` — chat history per sessionId per user
- `activityLog` — `(userId, action, recipeId, recipeName, createdAt)` — actions: recipe_added, recipe_deleted, plan_updated, plan_meal_added, pantry_added

### Recipe Categorization (`server/utils/categorization.ts: guessCategory()`)
- Always re-run `guessCategory(name)` at shopping list generation time — never trust stored `ing.category`
- Pantry/spices checked BEFORE produce to prevent "garlic powder" → produce
- Order: protein → frozen → bakery → grains → dairy → condiments → pantry → produce
- Extracted from routes.ts to utility module; 98 unit tests in `server/__tests__/guess-category.test.ts`

### Social Media Import (`POST /api/ai/import-from-social`)
- Two modes: `text` (paste caption) → haiku; `image` (screenshot upload) → sonnet-4-6 vision
- Returns same shape as URL import — frontend uses shared `populateFromImport()` helper
- 4 MB image size guard; strips data URL prefix automatically
- Rate-limited via `aiRateLimit` middleware

### Copilot Recipe Search (`server/services/spoonacular.ts: searchRecipesForCopilot()`)
- First search: Spoonacular complexSearch + Edamam in parallel via `Promise.allSettled`, results interleaved
- "Find different" (`attempt > 0`): random Spoonacular + Edamam parallel, interleaved
- 5-level fallback cascade if Spoonacular returns < 3: relax time → drop type → drop protein → drop cuisine → Edamam only → TheMealDB
- `protein=sides` is treated as a mealType override, not an ingredient filter
- `type=snack` avoided in Spoonacular (nearly empty); uses `query=snack + maxReadyTime=20` instead

---

## Frontend Patterns

### TanStack Query
- All queries use path-based keys: `["/api/recipes"]`, `["/api/plans", weekStart]`
- After mutations, invalidate with `queryClient.invalidateQueries({ queryKey: ["/api/recipes"] })`
- Recipe dialog uses `selectedRecipeId` (not full object) so live query data auto-updates after clean

### Routing (Wouter)
- Routes defined in `client/src/App.tsx`
- Auth guard: unauthenticated → redirected to `/auth`
- Pages: `/` (recipes), `/planner`, `/shopping`, `/pantry`, `/profile`, `/auth`, `/onboarding`

### Shared Utilities
- `client/src/lib/ingredientCategories.ts` — `categorizeIngredient()`, `getIngredientChipClass()`, `groupIngredientsByCategory()` — used by both CopilotPanel chips and recipe-dialog grouped ingredient list
- `client/src/lib/format-time.ts` — `formatTimeBreakdown(prep, cook)`

### Copilot Panel (`client/src/components/CopilotPanel.tsx`)
- Right drawer on desktop, bottom sheet on mobile
- When `hasResults`: questions collapse to compact summary chip row (saves scroll)
- Taste profile dots on cuisine options derived from cached `/api/recipes` — no extra fetch
- Protein step is optional (step 4) — `readyToSearch` only requires meal + cuisine + vibe

---

## Cuisine & Tag System (as of 2026-04-10)

### Cuisines (7 values)
`tex-mex`, `italian`, `asian`, `american`, `mediterranean`, `indian`, `other`
- UI colors: orange, red, emerald, blue, cyan, yellow, purple
- `guessCuisine(title, ingredients[])` in `server/routes.ts` — keyword-based, used for URL imports
- `normalizeCuisine(raw, title)` inline in `server/routes/ai.ts` save-recipe — handles Spoonacular cuisine strings + title fallback

### Tags (auto-detected on save)
`crockpot`, `slow-cook`, `grilled`, `quick`, `make-ahead`, `freezer-friendly`, `one-pot`, `one-pan`, `air-fryer`
- Auto-tag logic runs in both `server/routes.ts` (URL import) and `server/routes/ai.ts` (Spoonacular save)
- Detect from title keywords: crock.?pot → crockpot; air.?fry → air-fryer; grill|bbq → grilled
- Detect from cook time: ≤30min → quick; ≥240min + not crockpot → slow-cook
- Tags saved from Spoonacular are diets array merged with auto-detected method tags

---

## Known Issues / Tech Debt (as of 2026-04-16)

### Security (open, non-blocking)
- SEC-009: Some household routes use inline `req.isAuthenticated()` rather than `requireAuth` middleware — functionally identical, stylistically inconsistent
- SEC-010: No CSRF tokens — deferred post-launch. SameSite=Lax on session cookie partially mitigates.

### Data Quality
- Duplicate near-identical ingredient names in shopping list ("boneless skinless" vs "boneless, skinless") — needs fuzzy dedup
- Some recipe ingredients have instruction text baked into the name (e.g. "to 6 cups prepared mashed potatoes (see notes)")
- Onboarding dish thumbnails broken (bad seed image URLs)

### Performance
- In-memory AI response cache (`server/utils/cache.ts`) — grows unbounded, no eviction
- Spoonacular `fillIngredients: true` costs extra quota points — consider dropping for count-only queries

---

## Development

```bash
npm run dev        # starts Express + Vite HMR on port 5000
npx tsc --noEmit   # type check (target ES2020 — required for gis regex flag)
npm test           # run test suite (vitest, no DB/API keys needed)
npm run test:watch # watch mode during development
```

Server changes require a manual restart (tsx doesn't watch by default in this setup). Kill with `npx kill-port 5000`.

---

## Security & Testing Docs

Full living documents — read these before touching auth, routes, or storage:

- **`docs/SECURITY_AUDIT.md`** — every security finding, fix, commit reference, and open item. Update this whenever a security change is made.
- **`docs/TESTING.md`** — test philosophy, coverage map (what's tested / what's not), and the roadmap for Tier 2–4 tests.

### Security rules (non-negotiable)
- `householdId` always comes from `req.user.householdId` — never from request body or params.
- Every route that touches user data must use `requireAuth` middleware, not inline `if (!req.user)` checks.
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
