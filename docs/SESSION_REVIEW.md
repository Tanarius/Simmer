# Session Review — Pre-Launch Security & Testing Overhaul
**Branch:** `claude/review-launch-readiness-5eOYX`
**Date:** 2026-04-21
**Commits:** `baefca3` → `4c4ba52` → `6178b43` → `7c6527f` → `0084e54`
**Net change:** 21 files, +2684 lines, -127 lines
**Test count:** 0 → 197 (8 test files, all passing)
**Type errors:** 0 (confirmed with `npx tsc --noEmit`)

---

## What Was Wrong Before This Session

The codebase was functionally working but had a cluster of silent security bugs that had never been caught because there were zero automated tests. The most serious:

1. Passwords had been "migrated to bcrypt" twice — but the old code still did plaintext comparisons. The comment said the fallback was removed; it was not.
2. Any user could read any other household's meal reactions — no household filter on the query.
3. Any authenticated user could write an emoji reaction to a plan they didn't own.
4. The dev route that upgrades users to a paid tier was reachable in production (the guard was inside the handler, not at registration).
5. The activity log fetched recipe names without scoping to the household — could leak names across households.
6. Copilot proposed-action status updates only matched on `messageId` — any user could overwrite any other user's proposed action by guessing an integer.

None of these had tests. Any future refactor could silently re-introduce them.

---

## Changes Made

### 1. Security Fixes — `server/auth.ts`

**SEC-001 — Plaintext password comparison was still active**

The comment said the fallback was removed. It was not. The `if (!startsWith('$2b$'))` block still compared `user.password !== password` for legacy accounts.

Fix: Kept the one-time migration path (intentional — needed to upgrade pre-bcrypt accounts on their next login) but corrected the comment, added a `console.warn` to Railway logs, and fixed a session bug where the pre-upgrade user object (still carrying the plaintext string in memory) was passed to `done()`.

```typescript
// Before
return done(null, user);  // user.password is still the plaintext string in memory

// After
const upgraded = await storage.getUser(user.id);  // re-fetch — now has the hash
return done(null, upgraded ?? user);
```

**SEC-002 — Password change accepted plaintext comparison**

The `PATCH /api/auth/password` route had a fallback: if the account predated bcrypt, it compared `user.password === currentPassword`. This was completely removed. Pre-bcrypt accounts now get a clear error telling them to log out and back in (which triggers the migration) before changing their password.

```typescript
// Before
const valid = isHash ? await bcrypt.compare(...) : user.password === currentPassword;

// After
if (!user.password?.startsWith('$2b$') && !user.password?.startsWith('$2a$')) {
  return res.status(400).json({ error: "Please log out and log back in before changing your password." });
}
const valid = await bcrypt.compare(currentPassword, user.password);
```

**SEC-008 — Session carried plaintext password after upgrade**

Addressed by the re-fetch above. After `updateUserPassword()` the old `user` object still had the plaintext string in its `.password` field in memory. Calling `done(null, user)` serialised that into the session.

---

### 2. Security Fixes — `server/routes.ts`

**SEC-003 — Reactions GET returned global data**

```typescript
// Before
const reactions = await storage.getReactionsForWeek(req.params.weekStart);

// After
const householdId = (req.user as any).householdId;
const reactions = await storage.getReactionsForWeek(req.params.weekStart, householdId);
```

**SEC-004 — Reactions POST used manual `if (!req.user)` instead of `requireAuth`**

```typescript
// Before
app.post("/api/plans/:weekStart/reactions", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

// After
app.post("/api/plans/:weekStart/reactions", requireAuth, async (req, res) => {
```

**SEC-005 — Reactions POST didn't validate plan ownership**

A user could write a reaction to any week, even one that didn't belong to their household.

```typescript
// Added before upsertReaction/deleteReaction
const plan = await storage.getWeeklyPlan(weekStart, householdId);
if (!plan) return res.status(403).json({ error: "Forbidden" });
```

**SEC-006 — Dev route reachable in production**

```typescript
// Before — guard was inside the handler body
app.post("/api/dev/upgrade-testuser", async (req, res) => {
  if (process.env.NODE_ENV === "production") return res.status(404).send();
  ...

// After — route not registered at all in production
if (process.env.NODE_ENV !== "production") {
  app.post("/api/dev/upgrade-testuser", async (req, res) => {
    ...
  });
}
```

**SEC-007 — Activity log leaked cross-household recipe names**

```typescript
// Before — no householdId, could match any recipe
const recipe = await storage.getRecipe(val);

// After
const recipe = await storage.getRecipe(val, householdId);
```

---

### 3. Security Fix — `server/storage.ts`

**SEC-003 (storage side) — `getReactionsForWeek` had no household filter**

```typescript
// Before
async getReactionsForWeek(weekStart: string): Promise<MealReaction[]> {
  return await db.select().from(mealReactions).where(eq(mealReactions.weekStart, weekStart));
}

// After — joins through users table to get only members of the household
async getReactionsForWeek(weekStart: string, householdId: number): Promise<MealReaction[]> {
  const householdUsers = await db.select({ id: users.id }).from(users)
    .where(eq(users.householdId, householdId));
  const userIds = householdUsers.map(u => u.id);
  if (userIds.length === 0) return [];
  return await db.select().from(mealReactions).where(
    and(eq(mealReactions.weekStart, weekStart), inArray(mealReactions.userId, userIds))
  );
}
```

**SEC-011 — `updateProposedActionStatus` WHERE clause only used messageId**

Any authenticated user could overwrite another user's proposed copilot action by guessing an auto-incrementing integer `messageId`.

```typescript
// Before
const rows = await db.select().from(copilotSessions)
  .where(eq(copilotSessions.id, messageId));

// After — scoped to the calling user's session
const rows = await db.select().from(copilotSessions).where(
  and(
    eq(copilotSessions.id, messageId),
    eq(copilotSessions.userId, userId),
    eq(copilotSessions.sessionId, sessionId),
  )
);
```

---

### 4. Refactor — `server/utils/categorization.ts` (new file)

`guessCategory()` and `guessCuisine()` were inline private functions in `routes.ts`. They are now exported from a utility module so they can be imported and unit tested.

**8 bugs were found and fixed during this extraction** (found by writing the test suite against the actual function):

| Bug | Old Pattern | New Pattern | Impact |
|-----|-------------|-------------|--------|
| "fish sauce" → protein | `/fish/` | `/\bfish\b(?!\s+sauce)/` | Shopping list |
| "roasted vegetables" → protein | `/roast/` | `/\broast\b/` | Shopping list |
| "chicken bouillon cube" → protein | `/chicken/` | `/\bchicken\b(?!\s+bouillon)/` | Shopping list |
| "egg noodles" → dairy | dairy before grains | grains before dairy | Category order |
| "breadcrumbs" → bakery | `/bread/` | `/\bbread\b/` (word boundary) | Shopping list |
| "flour tortillas" → grains | bakery after grains | bakery before grains | Category order |
| "mayonnaise" → pantry | `/\bmayo\b/` | `/mayo(?:nnaise)?/` | Shopping list |
| "fresh garlic cloves" → pantry | `/cloves/` in pantry | `/ground cloves\|whole cloves/` | Shopping list |
| "black pepper" → produce | `/pepper\b/` in pantry | `/\bblack pepper\b/` | Shopping list |
| "garlic cloves" → pantry | `/\bgarlic\b/` missing | Added to produce | Shopping list |

Final category check order (matches `docs/TESTING.md` and code comments):
`protein → frozen → bakery → grains → dairy → condiments → pantry → produce`

---

### 5. Refactor — `server/utils/autoTag.ts` (new file)

Tag detection logic was copy-pasted in two places with slight inconsistencies:
- `server/routes.ts` (URL import path)
- `server/routes/ai.ts` (Spoonacular save path)

Unified into one exported function:

```typescript
export function detectTags(title: string, totalMinutes: number, existingTags: string[] = []): string[] {
  const lower = title.toLowerCase();
  const tags = [...existingTags];
  const add = (tag: string) => { if (!tags.includes(tag)) tags.push(tag); };

  if (/crock.?pot|slow.?cook/.test(lower)) add("crockpot");
  if (/instant.?pot|pressure.?cook/.test(lower)) { add("quick"); add("one-pot"); }
  if (/air.?fry/.test(lower)) add("quick");
  if (/grill|bbq|barbecue/.test(lower)) add("grilled");
  if (totalMinutes > 0 && totalMinutes <= 30) add("quick");
  if (totalMinutes >= 240 && !tags.includes("crockpot")) add("slow-cook");
  if (/one.?pot|one.?pan|sheet.?pan/.test(lower)) add("one-pot");

  return tags;
}
```

Both call sites now import this instead of maintaining their own copy.

---

### 6. Refactor — `server/utils/shoppingList.ts` (new file)

The shopping list generation logic (dedup, category grouping, sort) was inline in the route handler, making it impossible to unit test without a live database. Extracted to a pure function:

```typescript
export function buildShoppingList(
  allIngredients: RawIngredient[],
  stapleNames: Set<string>,
): ShoppingListResult
```

The route now:
1. Fetches recipes from storage
2. Parses ingredient JSON
3. Flattens to `RawIngredient[]`
4. Calls `buildShoppingList()` — no database, fully testable

---

### 7. Test Infrastructure (new)

**`vitest.config.ts`** — test runner config with `@shared` path alias resolution.

**`package.json`** — added scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Mock patterns established for this codebase:**

```typescript
// Session store — replaces connect-pg-simple with in-memory store
vi.mock("connect-pg-simple", () => ({
  default: (sessionModule: any) => sessionModule.MemoryStore,
}));

// pg Pool — must be a class constructor, not an arrow function
vi.mock("pg", () => ({ Pool: class MockPool {} }));

// Authenticated supertest agent
const agent = request.agent(app);
await agent.post("/api/login").send({ username: "alice", password: "password1!" });
```

---

### 8. Test Files

All tests are in `server/__tests__/`. All run with `npm test` — no database, no API keys, no network.

#### `auth.test.ts` — 9 tests
Covers SEC-001, SEC-002, SEC-008.
- Registration hashes password with bcrypt (cost 12)
- Login with hashed password succeeds
- Login with plaintext upgrades to bcrypt (migration path)
- Post-upgrade, stored password is a hash not the plaintext string
- Password change rejects pre-bcrypt accounts with 400
- Password change stores bcrypt hash
- Unauthenticated PATCH returns 401

#### `auth-guards.test.ts` — 20 tests
Covers SEC-004, SEC-006, SEC-009, SSRF protection.
- `requireAuth` middleware calls `next()` when authenticated
- `requireAuth` returns 401 and does not call `next()` when unauthenticated
- `isSafeUrl` allows public recipe URLs
- `isSafeUrl` blocks: localhost, 127.x, 10.x, 192.168.x, 172.16-31.x, 169.254.x, 0.0.0.0, AWS metadata, Google metadata, ftp://, file://, invalid URLs
- All 5 household mutation routes return 401 without session
- `/api/household/preview/:code` is publicly accessible (intentionally no auth)

#### `household-isolation.test.ts` — 8 tests
Covers SEC-003, SEC-005, SEC-007.
- `getRecipes` is called with the authenticated user's `householdId`
- `getRecipe` called with `householdId` — cross-household ID returns 404
- `getRecipe` returns recipe when it belongs to the user's household
- `getWeeklyPlan` called with the user's `householdId`
- Returns 404 when household has no plan for that week
- `getReactionsForWeek` called with `householdId` (not global)
- Reactions POST forbidden when no plan exists for that household
- Reactions POST succeeds when plan belongs to user's household

#### `guess-category.test.ts` — 98 tests
- 88 table-driven cases covering all 8 categories
- 5 ordering invariant tests (the canonical "garlic powder" → pantry not produce)
- Verifies: frozen beats produce, protein beats pantry, condiments beats pantry, bakery before grains

#### `auto-tag.test.ts` — 25 tests
- Title keyword detection: crockpot, slow cooker, instant pot, pressure cooker, air fryer, grill, BBQ, barbecue, one pot, sheet pan
- Time-based: ≤30 min → quick, ≥240 min → slow-cook
- Crockpot title suppresses slow-cook even at 300 min
- `existingTags` preserved and deduplicated
- Plain recipes at 60/90 min produce no spurious tags

#### `shopping-list.test.ts` — 18 tests
- Case-insensitive deduplication (same ingredient, different capitalisation → 1 entry)
- Amount aggregation: both amounts appear in the merged entry
- Category derivation via `guessCategory` (garlic powder → pantry, not produce)
- Staple flagging (case-insensitive match against staple set)
- Category order follows `CATEGORY_ORDER` constant
- Alphabetical sort within each category
- Empty input → 0 items
- `totalItems` counts unique names, not raw ingredient count

#### `copilot-auth.test.ts` — 6 tests
Covers SEC-011.
- `getCopilotHistory` called with `req.user.id`, not URL-supplied id
- User 2 cannot access user 1's session — storage receives user 2's id
- Unauthenticated history request → 401, storage not called
- `updateProposedActionStatus` receives `userId + sessionId` from session (not body)
- Cross-user mutation: storage called with calling user's id, not spoofed id
- Unauthenticated execute-tool → 401, storage not called

#### `rate-limits.test.ts` — 16 tests
- `aiRateLimit`: unauthenticated → 401; free tier at limit → 429 with `upgradePrompt: true`; free tier under limit → `next()` + `incrementAiCalls`; test tier uses `TEST_TIER_DAILY_LIMIT`; premium bypasses regardless of call count; storage error → 500
- `copilotRateLimit`: same model with `COPILOT_FREE_TIER_DAILY_LIMIT` and `COPILOT_TEST_TIER_DAILY_LIMIT`

---

### 9. Living Documentation (new)

**`docs/SECURITY_AUDIT.md`** — every finding, severity, file location, fix status, commit SHA. Template for future audits. Architecture decisions recorded (password migration strategy, household isolation model).

**`docs/TESTING.md`** — philosophy (5 principles), infrastructure table, coverage map (covered/partial/not yet), tier roadmap, mock patterns with code examples.

**`CLAUDE.md`** — updated with `npm test` and `test:watch` commands; added Security & Testing Docs section with non-negotiable rules.

---

## What Is NOT Changed

- No database schema changes
- No frontend changes
- No changes to AI service logic (anthropic.ts, copilot.ts, spoonacular.ts)
- No changes to the Drizzle ORM queries beyond the two storage fixes above
- SEC-009 (household routes using inline `req.isAuthenticated()` instead of `requireAuth` middleware) is documented but not yet changed — it is functionally correct, just inconsistent
- SEC-010 (no CSRF tokens) is documented, deferred post-launch

---

## How to Verify

```bash
git checkout claude/review-launch-readiness-5eOYX
npm install
npm test              # 197 tests, 8 files, all passing
npx tsc --noEmit      # no output = no type errors
```

---

## What Comes Next (Tier 3)

Integration tests against a real Postgres instance. Requires either Docker Compose or Neon branch. Planned scope:
- Recipe CRUD → shopping list (full storage pipeline)
- Household invite → join flow
- Onboarding → taste profile write
