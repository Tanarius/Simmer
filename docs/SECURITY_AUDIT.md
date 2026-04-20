# Security Audit Log

This document is the living security record for the MealPrep application.
Every audit, finding, and remediation is recorded here chronologically.
Update this file whenever a new security issue is found or fixed.

---

## Audit #1 — Pre-Launch Review
**Date:** 2026-04-20
**Branch:** `claude/review-launch-readiness-5eOYX`
**Commits:** `baefca3`, `4c4ba52`
**Scope:** Full codebase — auth, routes, storage, data isolation, session config, dev utilities

---

### Findings & Remediation Status

#### CRITICAL

| ID | Finding | File | Status | Fixed In |
|----|---------|------|--------|----------|
| SEC-001 | Plaintext password fallback still active despite comment claiming it was removed. Login compared `user.password !== password` for pre-bcrypt accounts. | `server/auth.ts:76-80` | ✅ Fixed | `baefca3` |
| SEC-002 | Password change (`PATCH /api/auth/password`) accepted plaintext password comparison — allowed changing password on accounts that had never logged in since bcrypt migration. | `server/auth.ts:177-178` | ✅ Fixed | `baefca3` |
| SEC-003 | Meal reactions returned global data — any user could read emoji reactions from any other household. `getReactionsForWeek()` had no household filter. | `server/routes.ts:471`, `server/storage.ts:604` | ✅ Fixed | `baefca3` |
| SEC-004 | Meal reactions `POST` endpoint used manual `if (!req.user)` instead of `requireAuth` middleware — inconsistent guard pattern. | `server/routes.ts:475` | ✅ Fixed | `baefca3` |
| SEC-005 | Meal reactions `POST` accepted writes without validating that the `weekStart` plan belonged to the requesting household. | `server/routes.ts:477-490` | ✅ Fixed | `baefca3` |

#### HIGH

| ID | Finding | File | Status | Fixed In |
|----|---------|------|--------|----------|
| SEC-006 | Dev route `/api/dev/upgrade-testuser` was registered on the Express app unconditionally — the `NODE_ENV === "production"` check was inside the handler, not at registration. Route was visible in all environments. | `server/routes.ts:208` | ✅ Fixed | `baefca3` |
| SEC-007 | Activity log called `storage.getRecipe(val)` without `householdId` — could leak another household's recipe name into the activity feed. | `server/routes.ts:454` | ✅ Fixed | `baefca3` |
| SEC-008 | Session upgrade bug: after upgrading a plaintext password to bcrypt, `done(null, user)` was called with the pre-update user object (still carrying the plaintext string in memory). | `server/auth.ts:85` | ✅ Fixed | `baefca3` |

#### MEDIUM

| ID | Finding | File | Status | Notes |
|----|---------|------|--------|-------|
| SEC-009 | Household routes (`GET /api/household`, `PATCH /api/household/name`, `POST /api/household/join`, `POST /api/household/regenerate`, `POST /api/household/leave`) use inline `req.isAuthenticated()` instead of `requireAuth` middleware — inconsistent, harder to audit. | `server/routes.ts:317-388` | ⚠️ Open | Functionally correct but should be standardised to `requireAuth`. |
| SEC-010 | No CSRF token validation — relies solely on `SameSite=lax` cookie policy. | Global | ⚠️ Open | Acceptable for MVP; revisit if moving to cross-origin requests. |
| SEC-011 | `GET /api/ai/copilot/history/:sessionId` and `GET /api/ai/copilot/execute-tool` — no `sessionId` ownership check; any authenticated user could read another user's copilot history by guessing a sessionId. | `server/routes/ai.ts:48,59` | ⚠️ Open | Requires sessionId scoped to userId. |
| SEC-012 | In-memory AI cache (`server/utils/cache.ts`) capped at 500 entries but no TTL expiry — stale AI responses can persist. | `server/utils/cache.ts` | ⚠️ Open | Low impact; add TTL in next iteration. |

#### LOW

| ID | Finding | File | Status | Notes |
|----|---------|------|--------|-------|
| SEC-013 | No rate limiting on recipe/plan CRUD operations — could be abused to inflate DB. | `server/routes.ts` | ⚠️ Open | Post-launch hardening. |
| SEC-014 | `POST /api/recipes/import-url` has no per-user rate limit — slow sites could hold server connections. | `server/routes.ts:700` | ⚠️ Open | Post-launch. |
| SEC-015 | Activity feed (`GET /api/activity`) fetches up to 40 entries with no cursor-based pagination. Large households will see slow responses over time. | `server/routes.ts:392` | ⚠️ Open | Post-launch. |

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
All storage methods accept `householdId` as an explicit parameter — never trust stored
`householdId` values passed in from client requests.

---

### Test Coverage for This Audit

All CRITICAL and HIGH findings above have automated test coverage:

| Test File | Covers |
|-----------|--------|
| `server/__tests__/auth.test.ts` | SEC-001, SEC-002, SEC-008 |
| `server/__tests__/auth-guards.test.ts` | SEC-004, SEC-006, SEC-009 |
| `server/__tests__/household-isolation.test.ts` | SEC-003, SEC-005, SEC-007 |

Run with: `npm test`

---

### Outstanding Work (Prioritised)

1. **SEC-009** — Migrate household routes to `requireAuth` middleware (consistency + auditability)
2. **SEC-011** — Scope copilot session history to `userId`
3. **SEC-010** — Evaluate CSRF token requirement as app scales
4. **SEC-013/014** — Add rate limiting to CRUD + import endpoints

---

## Adding Future Audits

Copy this template for each new audit:

```markdown
## Audit #N — <Title>
**Date:** YYYY-MM-DD
**Branch:** `branch-name`
**Commits:** `sha1`, `sha2`
**Scope:** <what was reviewed>

### Findings & Remediation Status
...
```
