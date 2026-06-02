# Security Audit Log

This document is the living security record for the Simmer application.
Every audit, finding, and remediation is recorded here chronologically.
Update this file whenever a new security issue is found or fixed.

---

## Audit #1 â€” Pre-Launch Review
**Date:** 2026-04-20
**Branch:** `claude/review-launch-readiness-5eOYX`
**Commits:** `baefca3`, `4c4ba52`
**Scope:** Full codebase â€” auth, routes, storage, data isolation, session config, dev utilities

---

### Findings & Remediation Status

#### CRITICAL

| ID | Finding | File | Status | Fixed In |
|----|---------|------|--------|----------|
| SEC-001 | Plaintext password fallback still active despite comment claiming it was removed. Login compared `user.password !== password` for pre-bcrypt accounts. | `server/auth.ts:76-80` | âœ… Fixed | `baefca3` |
| SEC-002 | Password change (`PATCH /api/auth/password`) accepted plaintext password comparison â€” allowed changing password on accounts that had never logged in since bcrypt migration. | `server/auth.ts:177-178` | âœ… Fixed | `baefca3` |
| SEC-003 | Meal reactions returned global data â€” any user could read emoji reactions from any other household. `getReactionsForWeek()` had no household filter. | `server/routes.ts:471`, `server/storage.ts:604` | âœ… Fixed | `baefca3` |
| SEC-004 | Meal reactions `POST` endpoint used manual `if (!req.user)` instead of `requireAuth` middleware â€” inconsistent guard pattern. | `server/routes.ts:475` | âœ… Fixed | `baefca3` |
| SEC-005 | Meal reactions `POST` accepted writes without validating that the `weekStart` plan belonged to the requesting household. | `server/routes.ts:477-490` | âœ… Fixed | `baefca3` |

#### HIGH

| ID | Finding | File | Status | Fixed In |
|----|---------|------|--------|----------|
| SEC-006 | Dev route `/api/dev/upgrade-testuser` was registered on the Express app unconditionally â€” the `NODE_ENV === "production"` check was inside the handler, not at registration. Route was visible in all environments. | `server/routes.ts:208` | âœ… Fixed | `baefca3` |
| SEC-007 | Activity log called `storage.getRecipe(val)` without `householdId` â€” could leak another household's recipe name into the activity feed. | `server/routes.ts:454` | âœ… Fixed | `baefca3` |
| SEC-008 | Session upgrade bug: after upgrading a plaintext password to bcrypt, `done(null, user)` was called with the pre-update user object (still carrying the plaintext string in memory). | `server/auth.ts:85` | âœ… Fixed | `baefca3` |

#### MEDIUM

| ID | Finding | File | Status | Notes |
|----|---------|------|--------|-------|
| SEC-009 | Household routes (`GET /api/household`, `PATCH /api/household/name`, `POST /api/household/join`, `POST /api/household/regenerate`, `POST /api/household/leave`) use inline `req.isAuthenticated()` instead of `requireAuth` middleware â€” inconsistent, harder to audit. | `server/routes.ts:317-388` | âš ï¸ Open | Functionally correct but should be standardised to `requireAuth`. |
| SEC-010 | No CSRF token validation â€” relies solely on `SameSite=lax` cookie policy. | Global | âš ï¸ Open | Acceptable for MVP; revisit if moving to cross-origin requests. |
| SEC-011 | `storage.updateProposedActionStatus` WHERE clause only matched on `messageId` â€” any authenticated user could mutate another user's proposed copilot action by guessing an integer messageId. | `server/storage.ts:462` | âœ… Fixed | Tier 2 commit |
| SEC-012 | In-memory AI cache (`server/utils/cache.ts`) capped at 500 entries but no TTL expiry â€” stale AI responses can persist. | `server/utils/cache.ts` | âš ï¸ Open | Low impact; add TTL in next iteration. |

#### LOW

| ID | Finding | File | Status | Notes |
|----|---------|------|--------|-------|
| SEC-013 | No rate limiting on recipe/plan CRUD operations â€” could be abused to inflate DB. | `server/routes.ts` | âš ï¸ Open | Post-launch hardening. |
| SEC-014 | `POST /api/recipes/import-url` has no per-user rate limit â€” slow sites could hold server connections. | `server/routes.ts:700` | âš ï¸ Open | Post-launch. |
| SEC-015 | Activity feed (`GET /api/activity`) fetches up to 40 entries with no cursor-based pagination. Large households will see slow responses over time. | `server/routes.ts:392` | âš ï¸ Open | Post-launch. |

---

### Architecture Decisions Recorded

**Password migration strategy (SEC-001):**
The plaintext fallback in the login path is intentional and is the ONLY acceptable location
for plaintext comparison. It exists to migrate accounts created before bcrypt was enforced.
Once every pre-migration account logs in, the block becomes unreachable.
A `console.warn` is emitted on each upgrade so Railway logs can confirm when migration
is complete. **Do not remove this block** until all plaintext accounts are gone.
**Do not add plaintext comparison anywhere else.**

**Household isolation model:**
`householdId` is always sourced from `req.user.householdId` (server-assigned, not from
request body or params). This is the single source of truth for data scoping.
All storage methods accept `householdId` as an explicit parameter â€” never trust stored
`householdId` values passed in from client requests.

---

### Test Coverage for This Audit

All CRITICAL and HIGH findings above have automated test coverage:

| Test File | Covers |
|-----------|--------|
| `server/__tests__/auth.test.ts` | SEC-001, SEC-002, SEC-008 |
| `server/__tests__/auth-guards.test.ts` | SEC-004, SEC-006, SEC-009 |
| `server/__tests__/household-isolation.test.ts` | SEC-003, SEC-005, SEC-007 |
| `server/__tests__/copilot-auth.test.ts` | SEC-011 |

Run with: `npm test`

---

### Outstanding Work (Prioritised)

1. **SEC-009** â€” Migrate household routes to `requireAuth` middleware (consistency + auditability)
2. **SEC-010** â€” Evaluate CSRF token requirement as app scales
3. **SEC-013/014** â€” Add rate limiting to CRUD + import endpoints

---

## Adding Future Audits

Copy this template for each new audit:

```markdown
## Audit #N â€” <Title>
**Date:** YYYY-MM-DD
**Branch:** `branch-name`
**Commits:** `sha1`, `sha2`
**Scope:** <what was reviewed>

### Findings & Remediation Status
...
```

