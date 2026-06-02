# Testing Strategy

This document defines the testing philosophy, coverage map, and roadmap for Simmer.
Update the coverage table whenever a new test file is added.

---

## Philosophy

1. **Tests protect behaviour, not implementation.** Test what the code does (outputs,
   side-effects, HTTP responses), not how it does it.

2. **Security tests are non-negotiable.** Every security fix must ship with a test that
   would have caught the original bug. See `docs/SECURITY_AUDIT.md` for the link between
   findings and tests.

3. **No external services in unit/integration tests.** Storage, AI APIs, email, and
   session stores are always mocked. Tests run offline in under 10 seconds.

4. **Table-driven tests for pure logic.** Functions like `guessCategory`, `guessCuisine`,
   and `parseIngredientString` have many edge-cases. A table of `[input, expected]` pairs
   is cheaper to maintain than individual test blocks.

5. **`npm test` is always green on `main`.** No skipped tests, no known failures.

---

## Running Tests

```bash
npm test            # run once (CI mode)
npm run test:watch  # watch mode during development
npx tsc --noEmit    # type check (run before every commit)
```

---

## Test Infrastructure

| Tool | Purpose |
|------|---------|
| `vitest` | Test runner â€” fast, native ESM, built-in mocking |
| `supertest` | HTTP assertions against Express apps without a live server |
| `bcrypt` | Used directly in auth tests to verify hash correctness |
| `vitest.config.ts` | Resolves `@shared/*` path alias; node environment |

---

## Coverage Map

### âœ… Covered

| File | Test File | What's Tested |
|------|-----------|---------------|
| `server/auth.ts` | `server/__tests__/auth.test.ts` | Registration hashes password; login with bcrypt; login plaintext upgrade; upgrade writes bcrypt not plaintext; password change rejects plaintext accounts; password change stores bcrypt hash; unauthenticated PATCH returns 401 |
| `server/middleware/requireAuth.ts` | `server/__tests__/auth-guards.test.ts` | Middleware rejects unauthenticated requests; passes authenticated requests; `isSafeUrl` blocks private IPs, loopback, non-http protocols, AWS metadata |
| `server/routes.ts` (household endpoints) | `server/__tests__/auth-guards.test.ts` | All household mutation routes return 401 without session |
| `server/routes.ts` (data isolation) | `server/__tests__/household-isolation.test.ts` | Recipe queries scoped to householdId; plan queries scoped; reactions scoped to household members; cross-household recipe ID returns 404 |
| `server/routes.ts` (`guessCategory`) | `server/__tests__/guess-category.test.ts` | All 8 categories; pantry-before-produce ordering; "garlic powder" â†’ pantry not produce; default fallback |
| `server/utils/autoTag.ts` | `server/__tests__/auto-tag.test.ts` | Title keyword detection (crockpot, instant pot, air fryer, grill, one-pot, sheet pan); time-based quick/slow-cook; existingTags deduplication; premium tag preservation |
| `server/utils/shoppingList.ts` | `server/__tests__/shopping-list.test.ts` | Ingredient deduplication (case-insensitive); amount aggregation; category derivation via guessCategory; staple flagging; CATEGORY_ORDER sort; alpha sort within category |
| `server/middleware/aiRateLimit.ts` | `server/__tests__/rate-limits.test.ts` | Unauthenticated â†’ 401; free tier at limit â†’ 429 with upgradePrompt; test tier uses TEST limit; premium bypasses; storage error â†’ 500; copilotRateLimit same model |
| `server/routes/ai.ts` (copilot ownership) | `server/__tests__/copilot-auth.test.ts` | getCopilotHistory called with req.user.id not URL-supplied id; updateProposedActionStatus receives correct userId+sessionId (SEC-011) |

### âš ï¸ Partially Covered

| Area | Gap | Priority |
|------|-----|----------|
| `server/auth.ts` | Password reset flow (forgot/reset token) not tested | Medium |

### âŒ Not Yet Covered

| Area | Planned Test File | Priority | Notes |
|------|-------------------|----------|-------|
| `guessCuisine()` | `server/__tests__/guess-cuisine.test.ts` | Medium | Pure function |
| Full recipe CRUD flow | `server/__tests__/recipes.integration.test.ts` | Medium | Needs test DB |
| Weekly planner flow | `server/__tests__/planner.integration.test.ts` | Medium | Needs test DB |
| Frontend components | `client/src/__tests__/` | Low | Needs Playwright/RTL setup |

---

## Test Tiers

### Tier 1 â€” Security & Core Guards *(done)*
Proves the security model holds. Must pass before any deployment.
- Auth password handling
- Route auth guards
- Household data isolation
- `guessCategory` (core shopping list logic)

### Tier 2 â€” Business Logic *(done)*
Proves the core user-facing features produce correct output.
- Shopping list generation (`buildShoppingList`)
- Auto-tag detection (`detectTags`)
- Copilot session ownership (SEC-011)
- AI rate limit enforcement (free / test / premium tiers)

### Tier 3 â€” Integration *(post-launch)*
End-to-end flows against a real test database schema.
- Recipe CRUD + weekly plan â†’ shopping list
- Onboarding â†’ taste profile derivation
- Household invite + join flow

### Tier 4 â€” Frontend / E2E *(post-launch)*
Browser-level tests via Playwright.
- Copilot flow
- Planner drag-and-drop
- Shopping list check/uncheck persistence

---

## Adding Tests

1. Place unit/integration tests in `server/__tests__/` with the `.test.ts` suffix.
2. Place frontend tests in `client/src/__tests__/`.
3. Mock all external services â€” no real DB, no real API keys.
4. After writing tests, update the **Coverage Map** table above.
5. Run `npm test && npx tsc --noEmit` and confirm both pass before committing.
6. If the test covers a security finding, record it in `docs/SECURITY_AUDIT.md`.

---

## Mock Patterns

### Session store (no DB)
```typescript
vi.mock("connect-pg-simple", () => ({
  default: (sessionModule: any) => sessionModule.MemoryStore,
}));
vi.mock("pg", () => ({ Pool: class MockPool {} }));
process.env.SESSION_SECRET = "test-only";
```

### Storage
```typescript
vi.mock("../storage", () => ({
  storage: {
    getUserByUsername: vi.fn(),
    getUser: vi.fn(),
    // ... add methods as needed per test
  },
}));
```

### Authenticated supertest session
```typescript
const agent = request.agent(app);
await agent.post("/api/login").send({ username: "alice", password: "password123" });
// agent now carries a valid session cookie
const res = await agent.get("/api/recipes");
```

