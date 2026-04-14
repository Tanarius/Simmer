# MealPrep — Project Document
*For discussion with another Claude instance. Last updated: 2026-04-10.*

---

## What This Is

MealPrep is a household meal planning web app. A small group (roommates, family, couple) shares one account space: a recipe library, a weekly planner, a pantry tracker, and a shopping list. An AI copilot helps them plan meals around their taste preferences, pantry contents, and constraints.

**Live deployment**: Railway (PostgreSQL via Neon)
**Repository**: https://github.com/Tanarius/mealprep

---

## Current Feature Set

### Core
- **Recipe Library** — CRUD recipes with ingredients (JSON), instructions (JSON), cuisine tag, cook/prep time, servings, image URL. Favorite toggle. URL import (JSON-LD schema.org extraction + HTML fallback).
- **Weekly Planner** — Drag-and-drop meal planning grid (Mon–Sun × breakfast/lunch/dinner). Breakfast row toggle (localStorage). Day notes. Meal attribution (who added what slot). Emoji reactions per slot.
- **Shopping List** — Auto-generated from planned recipes. Ingredients grouped by store category, deduped, quantities combined.
- **Pantry** — Pantry staples tracker. Activity feed (recipe added, deleted, plan updated, meal added).
- **Household System** — Users belong to a household. Invite via shareable link (`/#/join/<code>`). 16-char invite tokens. Regenerate to invalidate old links. Member list. Leave household. Rename household.

### AI Features (powered by Anthropic Claude)
- **Kitchen Copilot** — Conversational assistant in a right drawer/bottom sheet. Multi-step: picks meal type → cuisine → vibe → protein (optional) → searches Spoonacular + Edamam → returns 3 recipes → can save directly to library.
- **Pantry Chef** — Suggests recipes from current pantry contents.
- **Weekly Plan AI** — Generates a full week plan using Anthropic based on taste profile.
- **Recipe Cleaner** — Normalizes imported recipes (strips ads, fixes units, reformats instructions).
- **Auto-tagging** — Tags recipes as crockpot / grilled / air-fryer / quick / slow-cook / make-ahead / freezer-friendly / one-pot at save time.

### User System
- Local username/password auth (Passport.js). bcrypt hashing with legacy plaintext upgrade-on-login.
- Subscription tiers: `free` (5 AI calls/day, 20 copilot/day), `test` (50 each), `premium` (unlimited).
- Taste profile: liked cuisines, disliked ingredients, ingredient substitutions, complexity preference.
- Onboarding flow: cooking mode → dietary needs → cuisine preferences → dietary restrictions.
- Profile page: invite link, member avatars, cuisine preferences, AI constraints, change password.

---

## Technical Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite, TailwindCSS, shadcn/ui |
| State | TanStack Query v5 (path-keyed: `["/api/recipes"]`) |
| Routing | Wouter with hash location (`/#/planner`) |
| Backend | Express + TypeScript (tsx), Node 20 |
| Auth | Passport.js local strategy, express-session (MemoryStore) |
| Database | PostgreSQL (Neon), Drizzle ORM |
| AI | Anthropic Claude (claude-3-5-sonnet) |
| Recipe APIs | Spoonacular (365k recipes, free tier) + Edamam (paid, 2.3M) + TheMealDB (free fallback) |
| Deployment | Railway (was Render) |
| Security | Helmet.js, express-rate-limit, bcrypt, SSRF validator |

---

## Architecture Overview

```
client/                     # React SPA
  src/
    pages/                  # recipes, planner, shopping, pantry, profile, auth, join, onboarding
    components/             # CopilotPanel, AppSidebar, ActivityFeed, RecipeDialog, ...
    lib/                    # ingredientCategories, queryClient, format-time

server/
  index.ts                  # helmet, rate limits, body limits, error handler
  auth.ts                   # Passport setup, auth routes (/api/register, /api/login, ...)
  routes.ts                 # all non-AI routes
  routes/
    ai.ts                   # /api/ai/* (copilot, suggest, save, clean, weekly-plan)
    onboarding.ts           # /api/onboarding/*
  middleware/
    requireAuth.ts          # requireAuth middleware + isSafeUrl SSRF check
    aiRateLimit.ts          # per-user AI call counting
  services/
    anthropic.ts            # weekly plan, pantry suggest, auto-tag
    copilot.ts              # copilot chat session management
    spoonacular.ts          # recipe search with 5-level fallback cascade
    edamam.ts               # Edamam recipe search
    recipeCleaner.ts        # Claude-powered recipe normalization
    tasteProfile.ts         # taste profile helpers
  storage.ts                # Drizzle ORM data access layer
  utils/
    invite.ts               # 16-char invite code generator
    cache.ts                # in-memory AI response cache (TTL-based)

shared/
  schema.ts                 # Drizzle schema + Zod types (shared by client + server)
```

### Key Data Model

```
households      id, name, inviteCode, createdAt
users           id, username, password (bcrypt), householdId, subscriptionTier, ...
recipes         id, name, ingredients (JSON), instructions (JSON), cuisine, tags, ...
weeklyPlans     id, weekStart, householdId, meals (JSON), mealMeta (JSON)
meal_reactions  weekStart, slotKey, userId, emoji — UNIQUE(week, slot, user)
userTasteProfile userId, dislikedIngredients[], likedCuisines[], substitutions{}, complexity
copilotSessions id, userId, sessionId, messages (JSON), updatedAt
activityLog     userId, action, recipeId, recipeName, createdAt
pantryStaples   id, householdId, name, category, quantity, unit
onboardingState userId, completed, currentStep, cookingMode, ...
```

---

## Security Audit & Status

### Completed (this session)
| # | Issue | Fix Applied |
|---|---|---|
| 1 | No security headers | Helmet.js added to `server/index.ts` |
| 2 | No body size limits (DoS) | 1 MB limit on JSON + urlencoded |
| 3 | No global API rate limit | 300 req/min per IP on `/api/*` |
| 4 | Auth endpoints brute-forceable | `authRateLimit` (10/15min) + `registerRateLimit` (5/hr) |
| 5 | Passwords stored plaintext | bcrypt (cost 12); legacy upgrade-on-login |
| 6 | Production missing env var check | `server/index.ts` exits if `SESSION_SECRET`/`DATABASE_URL` absent |
| 7 | Response body logged (leaks tokens) | Logger now only logs method + path + status + ms |
| 8 | Register accepts any input | Username: 3–30 chars, `[a-zA-Z0-9_.-]` only; password: 8+ chars |
| 9 | All mutating routes unprotected | `requireAuth` middleware added to POST/PATCH/DELETE recipes, plans, staples, taste-profile, import-url |
| 10 | AI + onboarding routes unprotected | `requireAuth` added at router registration level |
| 11 | SSRF via URL import | `isSafeUrl()` blocks localhost, 10.x, 192.168.x, 172.16-31.x, 169.254.x, metadata endpoints |
| 12 | SSRF via og-image proxy | Same `isSafeUrl()` check |
| 13 | Dev endpoint exposed in production | `POST /api/dev/upgrade-testuser` returns 404 in production |
| 14 | Invite code too short (guessable) | Upgraded from 8-char to 16-char tokens (alphanumeric, no ambiguous chars) |
| 15 | No confirmation before join | Join page shows household preview + confirmation step |
| 16 | Broken error handler (was before routes) | Moved to after all routes in `server/index.ts` |
| 17 | Stack traces leaked to clients | Error handler returns generic message for 5xx, only logs internally |

### Still Open (prioritize before public launch)
| # | Issue | Severity | Notes |
|---|---|---|---|
| 1 | No CSRF protection | Medium | Session cookies without `SameSite` strict or CSRF tokens. Mitigated somewhat by rate limits but not bulletproof. |
| 2 | No email verification | Low | Users can register with no email — no account recovery |
| 3 | `SESSION_SECRET` defaults to hardcoded string in dev | Low | Acceptable for local dev; production blocks on missing value |
| 4 | In-memory AI cache grows unbounded | Low | `server/utils/cache.ts` has no max-size eviction — memory leak under heavy load |
| 5 | No HTTPS enforcement | Low | Railway handles TLS termination; no HTTP→HTTPS redirect in app itself |
| 6 | Duplicate ingredients in shopping list | Low | Fuzzy dedup needed ("boneless skinless" vs "boneless, skinless") |
| 7 | Spoonacular `fillIngredients: true` wastes quota | Low | Costs extra API points on count-only queries |
| 8 | No audit log for auth events | Low | Login failures, password changes not logged |

**Critical for launch**: Items 1 above (CSRF). Data isolation and session persistence are now resolved.

---

## Business Model (Current Thinking)

### Subscription Tiers
- **Free**: 5 AI recipe suggestions/day, 20 copilot messages/day, full manual planner
- **Premium** (not yet priced/gated): Unlimited AI, Edamam access (2.3M recipes), future features

### Revenue Options to Evaluate
1. **Freemium SaaS** — $4–8/mo premium tier per household. Low friction, align with "household" unit (one payment for 2–4 users).
2. **One-time purchase + credits** — Pay once for app access, buy AI credit bundles. Lower recurring friction.
3. **Affiliate / recipe partnerships** — Link recipe sources; Spoonacular + Edamam have affiliate programs.
4. **Grocery integration** — Instacart/Kroger affiliate links on shopping list items (significant revenue potential).

---

## Growth & Acquisition Strategy (Ideas)

### Organic / Content
- **SEO recipe pages**: Each saved recipe as a public shareable page (`/recipes/:id/public`) — long-tail search traffic for recipe queries.
- **Meal plan templates**: Public shareable week plans ("college budget plan", "30-min weeknight meals") — Pinterest-friendly, viral potential.
- **TikTok/Reels**: Weekly plan time-lapses, pantry-to-table recipe reveals.

### Referral / Viral
- **Invite mechanic already built**: Invite link flow is designed for household sharing — this is a natural K-factor loop (one user invites roommates).
- **"Planned with MealPrep" share card**: After planning a week, generate a visual card to share. Brand exposure.

### Paid Acquisition
- **Meta/Instagram**: Target "meal prep", "roommates", "college students". Low CPM, visual product.
- **Pinterest ads**: Recipe content performs exceptionally well.
- **Reddit**: Organic + paid in r/MealPrepSunday (900k members), r/Frugal, r/college.

### Partnerships
- **Grocery delivery** (Instacart, Walmart+): Shopping list → one-click order. Revenue share potential.
- **Nutrition apps** (MyFitnessPal): Bi-directional sync — meal plan → calorie tracking.
- **Meal kit services** (HelloFresh, EveryPlate): Affiliate for users who want kits when they don't want to shop.

---

## Technical Roadmap

### Phase 1 — Launch Ready (blockers)
- [x] Household-scoped data isolation — DONE
- [x] PostgreSQL session store (connect-pg-simple) — DONE
- [ ] Premium tier payment (Stripe) — gate the AI calls properly
- [ ] Email/password reset flow (or "magic link")

### Phase 2 — Growth Features
- [ ] Public recipe pages + SEO
- [ ] Shareable meal plan cards
- [ ] Grocery delivery integration (Instacart link-out on shopping list)
- [ ] Mobile PWA polish (offline shopping list)
- [ ] Nutritional info display (from Spoonacular/Edamam data)

### Phase 3 — Platform
- [ ] Recipe rating + community saves
- [ ] "Remix" a recipe (AI variations)
- [ ] Smart pantry depletion tracking (cross-reference plan with pantry)
- [ ] Calendar sync (Google Calendar events for cooking nights)

---

## Known Issues / Tech Debt

See also `CLAUDE.md` at repo root for session-level notes.

- Duplicate ingredient dedup in shopping list (fuzzy match needed)
- Some recipe ingredients have instruction text baked into the name (Spoonacular issue)
- Onboarding dish thumbnails broken (bad seed image URLs)
- In-memory AI cache has no max size
- `type=snack` on Spoonacular is nearly empty — use query text instead
- Auth page invite code field shows on register tab — max 8 chars (was old format, invite codes are now 16 chars — fix the maxLength)

---

## Environment Variables Reference

```
ANTHROPIC_API_KEY       # Claude AI — required
DATABASE_URL            # Neon PostgreSQL — required
SESSION_SECRET          # Express session — required in production
SPOONACULAR_API_KEY     # 365k recipes, free tier
EDAMAM_APP_ID           # 2.3M recipes — PAID ($29/mo Recipe Search API)
EDAMAM_APP_KEY          # only activate with paid plan
PORT                    # defaults 5000
NODE_ENV                # "production" enables strict checks
```
