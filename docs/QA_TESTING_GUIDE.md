# Simmer â€” QA Testing Guide

**Last updated:** 2026-04-16  
**Author:** Cross-instance review + Claude Code  
**Purpose:** Comprehensive manual + automated QA reference. Every user-facing path, edge case, security check, and regression target is catalogued here. This is the go-to document before any release.

---

## How to Use This Guide

- **Before a release**: run all P0 + P1 items manually
- **For a quick smoke test**: run Section 1 (Auth) + Section 7 (Smoke Checklist) only
- **After a security change**: run Section 10 (Security Tests)
- **After a shopping list change**: run Section 5 (Shopping List) completely
- Tests marked ðŸ¤– can be automated via Playwright (Tier 4 on the test roadmap)
- Tests marked ðŸ” are security-critical â€” never skip them

---

## Test Accounts You Need

| Account | Tier | Purpose |
|---------|------|---------|
| `alice` | free | Standard user, Household A |
| `bob` | free | Second member of Household A |
| `charlie` | premium | Premium feature tests |
| `dave` | test | Rate limit tests (50/day) |
| Household B (separate account) | free | Cross-household isolation tests |

Set up these accounts on the Railway environment before a release test. Use `/api/dev/upgrade-testuser` **only in non-production** to set tiers.

---

## Section 1 â€” Authentication & Account Management

### 1.1 Registration
| # | Test | Expected | Priority |
|---|------|----------|----------|
| R-01 | Register with valid username (6+ chars, alphanumeric) and password (8+ chars) | Account created, redirect to `/onboarding` | P0 ðŸ¤– |
| R-02 | Register without email field | Error: "A valid email address is required" | P0 ðŸ” |
| R-03 | Register with invalid email (no TLD) | Rejected | P0 ðŸ” |
| R-04 | Register with username < 3 chars | Rejected | P1 |
| R-05 | Register with username containing spaces | Rejected (only `[a-zA-Z0-9_.-]` allowed) | P1 ðŸ” |
| R-06 | Register with password < 8 chars | Rejected | P1 |
| R-07 | Register with duplicate username | Error: "Username already taken" | P1 |
| R-08 | Register with duplicate email | Silent success (email collision handled gracefully) | P1 ðŸ” |
| R-09 | Attempt 6+ registrations from same IP in 1 hour | HTTP 429 from `registerRateLimit` | P1 ðŸ” |

### 1.2 Login
| # | Test | Expected | Priority |
|---|------|----------|----------|
| L-01 | Login with correct credentials | Redirect to `/` (recipe library) | P0 ðŸ¤– |
| L-02 | Login with wrong password | 401, error message shown | P0 |
| L-03 | Login with non-existent username | 401, generic error (no user enumeration) | P0 ðŸ” |
| L-04 | 11 failed login attempts within 15 minutes | HTTP 429 from `authRateLimit` | P1 ðŸ” |
| L-05 | Legacy bcrypt migration: first login with old plaintext-stored password | Login succeeds, password re-hashed, subsequent login uses bcrypt | P1 ðŸ” |
| L-06 | After bcrypt upgrade, open session still works | No re-login required mid-session | P1 |

### 1.3 Logout
| # | Test | Expected | Priority |
|---|------|----------|----------|
| LO-01 | Click "Sign out" in sidebar | Session destroyed, redirect to `/auth` | P0 ðŸ¤– |
| LO-02 | After logout, navigate to `/` directly | Redirect to `/auth` | P0 ðŸ” |
| LO-03 | After logout, all API calls return 401 | No data accessible | P0 ðŸ” |

### 1.4 Password Reset
| # | Test | Expected | Priority |
|---|------|----------|----------|
| PR-01 | Click "Forgot password?" on login page | Reset request form shown | P0 |
| PR-02 | Submit valid email for existing account | "If an account exists, you'll receive an email" (vague by design) | P0 ðŸ” |
| PR-03 | Submit email for non-existent account | Same vague success message (no email enumeration) | P0 ðŸ” |
| PR-04 | Click reset link in email within 15 min | Reset form loads with pre-filled token | P1 |
| PR-05 | Reset with new password < 8 chars | Rejected | P1 |
| PR-06 | Try to use reset link after it expires (>15 min) | "Reset link is invalid or has expired" | P1 ðŸ” |
| PR-07 | Use reset link twice | Second attempt rejected (token cleared on use) | P1 ðŸ” |
| PR-08 | 6+ reset attempts from same IP in 15 min | HTTP 429 from `forgotRateLimit` | P1 ðŸ” |

### 1.5 Password Change (Authenticated)
| # | Test | Expected | Priority |
|---|------|----------|----------|
| PC-01 | Change password with correct current password | Success, new password works | P1 |
| PC-02 | Change password with wrong current password | Rejected | P1 ðŸ” |
| PC-03 | Change password with new password < 8 chars | Rejected | P1 |
| PC-04 | Pre-bcrypt account attempts password change without re-login | 400: "Please log out and log back in first" | P1 ðŸ” |
| PC-05 | Unauthenticated PATCH to `/api/auth/password` | 401 | P0 ðŸ” |

---

## Section 2 â€” Recipe Library

### 2.1 Browse & Filter
| # | Test | Expected | Priority |
|---|------|----------|----------|
| RF-01 | Load recipe library with 0 saved recipes | Empty state with "Add your first recipe" CTA | P0 ðŸ¤– |
| RF-02 | Search by partial recipe name (case-insensitive) | Matching recipes shown, non-matching hidden | P0 ðŸ¤– |
| RF-03 | Filter by cuisine: "italian" | Only italian recipes shown | P1 |
| RF-04 | Filter by meal type: "lunch" | Only lunch recipes shown | P1 |
| RF-05 | Filter by tag: "quick" | Only recipes with that tag shown | P1 |
| RF-06 | Combine search + cuisine filter | Both conditions applied (AND logic) | P1 |
| RF-07 | Filter by favorites only | Only favorited recipes shown | P1 |
| RF-08 | Favorites filter off shows all | All recipes back | P1 |

### 2.2 Manual Recipe Add
| # | Test | Expected | Priority |
|---|------|----------|----------|
| RA-01 | Submit form with name, cuisine, meal type filled | Recipe created, appears in library | P0 ðŸ¤– |
| RA-02 | Submit with name missing | Validation error, no submit | P0 |
| RA-03 | Submit with cuisine missing | Validation error, no submit | P0 |
| RA-04 | Add multiple ingredients | All appear in saved recipe | P1 |
| RA-05 | Add multiple instruction steps | All steps saved in order | P1 |
| RA-06 | Add recipe tags manually | Tags persist on card | P1 |
| RA-07 | Submit unauthenticated | 401 | P0 ðŸ” |

### 2.3 URL Import
| # | Test | Expected | Priority |
|---|------|----------|----------|
| UI-01 | Import valid AllRecipes URL | Form fields auto-populate; name, ingredients, instructions filled | P0 ðŸ¤– |
| UI-02 | Import valid Food Network URL | Same as above | P1 |
| UI-03 | Import invalid URL (bad format) | Error toast: "Could not reach the URL" | P1 |
| UI-04 | Import URL with no recipe schema | Partial data or clear error | P1 |
| UI-05 | Import `http://localhost/` | Blocked by SSRF validator | P0 ðŸ” |
| UI-06 | Import `http://169.254.169.254/` (AWS metadata) | Blocked | P0 ðŸ” |
| UI-07 | Import `http://10.0.0.1/` | Blocked | P0 ðŸ” |
| UI-08 | Import `file:///etc/passwd` | Blocked | P0 ðŸ” |
| UI-09 | Import URL, review auto-filled form, save | Recipe saved with correct data | P1 |
| UI-10 | Import same URL twice | Both saved (no dedup at import level) | P2 |

### 2.4 Recipe View & Edit
| # | Test | Expected | Priority |
|---|------|----------|----------|
| RV-01 | Click recipe card â†’ view dialog opens | All recipe fields visible | P0 ðŸ¤– |
| RV-02 | Toggle favorite from card and from dialog | Both update UI immediately | P1 |
| RV-03 | Edit recipe name | Change persists after dialog close | P1 |
| RV-04 | Edit ingredients | Saved correctly as JSON | P1 |
| RV-05 | Auto-clean recipe via AI | Instructions normalized, form repopulates | P2 |
| RV-06 | Delete recipe | Removed from library, planner slots using it show placeholder | P1 |
| RV-07 | Delete recipe that's in a current week plan | Plan slot not broken â€” recipe name still shows from meta | P2 |

### 2.5 Social Media Import (NEW)
| # | Test | Expected | Priority |
|---|------|----------|----------|
| SI-01 | Open "Import from Social" tab in Add Recipe dialog | Tab visible, two sub-modes: Paste Text / Upload Screenshot | P0 |
| SI-02 | Paste an Instagram caption with clear recipe format | Form auto-populates with parsed recipe | P1 |
| SI-03 | Paste text with no recipe content | Error: "Could not extract a recipe from this text" | P1 |
| SI-04 | Upload screenshot of a recipe post (clear text) | Form auto-populates | P1 |
| SI-05 | Upload non-recipe image (e.g. a cat photo) | Error: "No recipe found in this image" | P2 |
| SI-06 | Upload a multi-slide screenshot with partial ingredients | Best-effort extraction with a warning | P2 |
| SI-07 | Submit social import unauthenticated | 401 | P0 ðŸ” |
| SI-08 | Submit oversized image (>4MB) | Rejected with size error before API call | P1 |

---

## Section 3 â€” Weekly Planner

### 3.1 Core Grid
| # | Test | Expected | Priority |
|---|------|----------|----------|
| WP-01 | Load planner for current week | Grid shows Monâ€“Sun Ã— lunch/dinner | P0 ðŸ¤– |
| WP-02 | Toggle breakfast row | Row appears/disappears, preference persists in localStorage | P1 |
| WP-03 | Click empty planner slot | Recipe picker modal opens | P0 |
| WP-04 | Select a recipe for a slot | Recipe appears in slot with name + cook time | P0 ðŸ¤– |
| WP-05 | Remove a recipe from a slot | Slot returns to empty | P1 |
| WP-06 | Navigate to previous/next week | Correct ISO Monday date used as key | P1 |
| WP-07 | Two household members both load the same week | Both see the same plan | P1 |

### 3.2 Day Notes
| # | Test | Expected | Priority |
|---|------|----------|----------|
| DN-01 | Add a note to Monday | Note persists on reload | P1 |
| DN-02 | Edit an existing note | Updated text saved | P1 |
| DN-03 | Notes are household-scoped | Member B sees notes Member A wrote | P1 |

### 3.3 Meal Attribution
| # | Test | Expected | Priority |
|---|------|----------|----------|
| MA-01 | Alice adds a slot â€” attribution shows "Alice" | Attribution stored in `meal_meta` | P2 |
| MA-02 | Bob views the same plan | Sees "Added by Alice" on that slot | P2 |

### 3.4 AI Weekly Plan
| # | Test | Expected | Priority |
|---|------|----------|----------|
| AI-WP-01 | Click "Generate AI Plan" with 5+ saved recipes | Plan populates all dinner slots | P1 |
| AI-WP-02 | Generate plan with 0 saved recipes | Error: "You need at least 1 recipe in your library" | P1 |
| AI-WP-03 | Free tier user who has used 5 AI calls today | 429 with upgrade prompt | P1 ðŸ” |
| AI-WP-04 | Existing plan slots are preserved when AI fills gaps | Only empty slots filled | P2 |

### 3.5 Emoji Reactions
| # | Test | Expected | Priority |
|---|------|----------|----------|
| ER-01 | React to a meal slot with ðŸ‘ | Reaction saved, visible to other household members | P1 |
| ER-02 | React again on same slot | Replaces previous reaction (upsert) | P1 |
| ER-03 | Remove reaction by clicking current one | Reaction deleted | P2 |
| ER-04 | ðŸ” User B cannot see Household A's reactions | GET reactions returns empty for wrong household | P0 ðŸ” |
| ER-05 | ðŸ” User B cannot POST reaction to a plan they don't own | 403 Forbidden | P0 ðŸ” |

---

## Section 4 â€” Pantry

### 4.1 Pantry Staples
| # | Test | Expected | Priority |
|---|------|----------|----------|
| PA-01 | Add pantry staple with name, category, quantity, unit | Item appears in pantry list | P0 |
| PA-02 | Delete a staple | Removed from list | P1 |
| PA-03 | Pantry items are shared across household | Bob sees items Alice added | P1 |
| PA-04 | Pantry items from Household B not visible to Household A | Isolation confirmed | P0 ðŸ” |

### 4.2 Activity Feed
| # | Test | Expected | Priority |
|---|------|----------|----------|
| AF-01 | Add recipe â†’ activity feed shows "recipe_added" event | Event appears with recipe name and username | P1 |
| AF-02 | Delete recipe â†’ "recipe_deleted" shown | Correct | P1 |
| AF-03 | Add meal to plan â†’ "plan_meal_added" shown | Correct | P1 |
| AF-04 | Click recipe name in activity feed (on Recipes page) | Opens recipe dialog via CustomEvent | P1 |
| AF-05 | Click recipe name in activity feed (from Pantry page) | Sets sessionStorage ID, navigates to Recipes page, opens dialog | P1 |
| AF-06 | ðŸ” Activity feed only shows this household's actions | Cross-household recipe names never appear | P0 ðŸ” |

---

## Section 5 â€” Shopping List

### 5.1 Generation
| # | Test | Expected | Priority |
|---|------|----------|----------|
| SL-01 | Plan a week with 3 recipes, generate shopping list | All ingredients from those 3 recipes appear | P0 ðŸ¤– |
| SL-02 | No plan for current week | Shopping list is empty with explanation | P0 |
| SL-03 | Two recipes share "olive oil" | Single "olive oil" entry (deduped), both amounts listed | P1 |
| SL-04 | "Olive Oil" and "olive oil" (different cases) | Treated as same item (case-insensitive dedup) | P1 |
| SL-05 | "Boneless chicken breast" appears twice with different amounts | Merged into one entry | P1 |
| SL-06 | Recipe uses "garlic powder" | Listed under Pantry, not Produce | P0 ðŸ” (logic bug risk) |
| SL-07 | Recipe uses "garlic cloves" | Listed under Produce | P0 (same bug risk) |
| SL-08 | Recipe uses "egg noodles" | Listed under Grains, not Dairy | P1 |
| SL-09 | Recipe uses "fish sauce" | Listed under Condiments, not Protein | P1 |
| SL-10 | Recipe uses "frozen corn" | Listed under Frozen, not Produce | P1 |
| SL-11 | Pantry staple "olive oil" exists â†’ olive oil in shopping list | Item marked as "in pantry" / greyed | P1 |

### 5.2 Interaction
| # | Test | Expected | Priority |
|---|------|----------|----------|
| SI-01 | Check off an item | Item struck-through, moves to bottom (or stays, depending on implementation) | P1 |
| SI-02 | Scale a recipe to 6 servings | Amber warning shown: "amounts not automatically scaled" | P1 |
| SI-03 | View recipe from shopping list sidebar | Recipe dialog opens | P1 |
| SI-04 | Shopping list with 1000+ ingredients | Renders without jank (O(1) Map lookup, not O(nÂ²)) | P2 |

---

## Section 6 â€” AI Features (Kitchen Copilot)

### 6.1 Copilot Flow
| # | Test | Expected | Priority |
|---|------|----------|----------|
| CP-01 | Open Copilot panel | Right drawer on desktop, bottom sheet on mobile | P0 ðŸ¤– |
| CP-02 | Complete step 1: pick meal type | Step 2 unlocks | P0 |
| CP-03 | Complete steps 1â€“3 (meal + cuisine + vibe) | "Search Recipes" button enabled (protein is optional) | P0 |
| CP-04 | Add protein (step 4) and search | Protein filtered into results | P1 |
| CP-05 | Receive 3 recipe results | Cards show name, time, ingredients | P0 |
| CP-06 | Click "Find different" | New set of 3 results returned | P1 |
| CP-07 | Save a recipe from copilot results | Recipe appears in library | P1 |
| CP-08 | Free tier â€” 21st copilot message today | 429 with "upgrade to premium" prompt | P1 ðŸ” |
| CP-09 | Premium user â€” no rate limit shown | Messages go through without limits | P1 |
| CP-10 | Vibes grid on mobile: 7 vibe options | No orphaned single item â€” uses grid-cols-2 sm:grid-cols-3 | P2 |

### 6.2 Pantry Chef
| # | Test | Expected | Priority |
|---|------|----------|----------|
| PC-01 | Add 5 pantry items, use Pantry Chef | 3 recipe suggestions using those items | P1 |
| PC-02 | Empty pantry, use Pantry Chef | Error or empty-pantry message | P1 |

### 6.3 Recipe Cleaner
| # | Test | Expected | Priority |
|---|------|----------|----------|
| RC-01 | Import messy URL recipe, run auto-clean | Instructions normalized, ingredient units standardized | P2 |
| RC-02 | 3 concurrent clean requests | Semaphore limits to 3 at once (no extra Anthropic calls if already at limit) | P2 |

---

## Section 7 â€” Household System

### 7.1 Setup & Invites
| # | Test | Expected | Priority |
|---|------|----------|----------|
| HH-01 | New user registers â†’ household auto-created | Household ID assigned | P0 |
| HH-02 | View invite link on Profile page | 16-char alphanumeric code in URL | P0 |
| HH-03 | Share invite link; second user clicks it | Preview page shows household name + current members | P1 |
| HH-04 | Second user confirms join | Added to household, shared data visible | P1 |
| HH-05 | Regenerate invite link | Old link no longer valid, new 16-char code issued | P1 ðŸ” |
| HH-06 | ðŸ” Guess a random 16-char code | 404 from preview endpoint | P1 ðŸ” |

### 7.2 Data Isolation
| # | Test | Expected | Priority |
|---|------|----------|----------|
| DI-01 | Household A recipes not visible to Household B | GET /api/recipes returns only householdId-scoped results | P0 ðŸ” |
| DI-02 | Household B cannot edit Household A's recipes | 403 or 404 | P0 ðŸ” |
| DI-03 | Household B plan not visible to Household A | GET /api/plans/:week returns 404 for another household's data | P0 ðŸ” |
| DI-04 | Activity log of Household A not in Household B feed | Zero cross-household activity leakage | P0 ðŸ” |
| DI-05 | Pantry of Household A not in Household B | Zero leakage | P0 ðŸ” |

---

## Section 8 â€” Profile & Onboarding

### 8.1 Taste Profile
| # | Test | Expected | Priority |
|---|------|----------|----------|
| TP-01 | Set liked cuisines: Italian, Asian | Saved to `userTasteProfile` | P1 |
| TP-02 | Add disliked ingredient: "cilantro" | Copilot suggests recipes without cilantro | P2 |
| TP-03 | Set complexity preference: "simple" | AI plan prefers simpler recipes | P2 |
| TP-04 | Taste profile changes are user-scoped | Bob's profile doesn't affect Alice's copilot | P1 |

### 8.2 Onboarding
| # | Test | Expected | Priority |
|---|------|----------|----------|
| OB-01 | New user â†’ redirected to `/onboarding` on first login | Onboarding flow starts | P0 |
| OB-02 | Complete all steps | `onboardingState.completed = true`, redirected to recipes | P1 |
| OB-03 | Skip onboarding | App works normally | P1 |
| OB-04 | Returning user skips onboarding | Not redirected back | P1 |

---

## Section 9 â€” Responsive / Mobile

| # | Test | Expected | Priority |
|---|------|----------|----------|
| M-01 | Load recipe library on 375px viewport | Cards stack, no overflow | P1 |
| M-02 | Copilot panel on mobile | Bottom sheet, not right drawer | P1 |
| M-03 | Weekly planner on mobile | Horizontal scroll or collapsed view | P1 |
| M-04 | Shopping list on mobile | Readable, checkboxes tappable | P1 |
| M-05 | Add recipe dialog on mobile | Scrollable, no content clipped | P1 |
| M-06 | Sidebar on mobile | Collapsed, toggled via hamburger | P1 |
| M-07 | Auth page on mobile | Form centered, usable | P1 |

---

## Section 10 â€” Security Tests

These must pass on every release without exception.

### Auth & Session
| # | Test | Method | Expected |
|---|------|--------|----------|
| SEC-01 | Unauthenticated access to `/api/recipes` | `GET /api/recipes` (no cookie) | 401 |
| SEC-02 | Unauthenticated POST to `/api/recipes` | `POST /api/recipes` (no cookie) | 401 |
| SEC-03 | Unauthenticated access to `/api/ai/copilot/chat` | POST no cookie | 401 |
| SEC-04 | After logout, session cookie rejected | Reuse old session | 401 |
| SEC-05 | Password in API response | `GET /api/user` â€” no `password` field in JSON | Automated (safeUser check) |

### Data Isolation
| # | Test | Method | Expected |
|---|------|--------|----------|
| SEC-06 | Read another household's recipe by ID | `GET /api/recipes/999` as wrong household | 404 |
| SEC-07 | Edit another household's recipe | `PATCH /api/recipes/999` as wrong household | 403 or 404 |
| SEC-08 | Read another household's plan | `GET /api/plans/2026-04-14` as wrong household | 404 or empty |
| SEC-09 | Read another household's reactions | `GET /api/plans/2026-04-14/reactions` as wrong household | Empty array (not 403, filtered at storage) |
| SEC-10 | POST reaction to another household's plan | `POST /api/plans/2026-04-14/reactions` as wrong household | 403 |

### Input Validation
| # | Test | Method | Expected |
|---|------|--------|----------|
| SEC-11 | XSS in recipe name | Save `<script>alert(1)</script>` as recipe name | Stored as text, never executed |
| SEC-12 | SQL injection in search | `GET /api/recipes?search='; DROP TABLE recipes;--` | No SQL error, safe query |
| SEC-13 | Oversized body | POST with 2MB JSON body | 413 (body limit 1MB) |
| SEC-14 | SSRF via URL import | Import `http://169.254.169.254/latest/meta-data/` | 400 with "unsafe URL" |
| SEC-15 | sessionStorage XSS path | Set `openRecipeId` to `<img onerror=...>` | Validated as positive integer, rejected |

### Dev Routes
| # | Test | Method | Expected |
|---|------|--------|----------|
| SEC-16 | `/api/dev/upgrade-testuser` on production | POST (production NODE_ENV) | Route not registered â€” 404 |
| SEC-17 | Brute force login | 11 attempts within 15 min | 429 |
| SEC-18 | Brute force password reset | 6 attempts within 15 min | 429 |

---

## Section 11 â€” Performance & Reliability

| # | Test | Expected | Priority |
|---|------|----------|----------|
| P-01 | Load recipe library with 500 recipes | Page renders in < 2s, no jank | P2 |
| P-02 | Shopping list with 50 recipes on the plan | Generates without timeout | P2 |
| P-03 | Copilot with 100 messages in session | History loads, scroll works | P2 |
| P-04 | Server restart | Sessions restored (PostgreSQL session store) | P1 |
| P-05 | Railway deploy â†’ health check passes | 200 on first request within 30s | P0 |
| P-06 | Missing `ANTHROPIC_API_KEY` on server | AI endpoints return 503 with clear error | P1 |

---

## Section 12 â€” Pre-Release Smoke Checklist

Run this checklist in order after every deploy. Takes ~8 minutes.

```
[ ] 1.  App loads at production URL (no blank screen, no 500)
[ ] 2.  Register a new account with email
[ ] 3.  Login with that account
[ ] 4.  Onboarding completes without error
[ ] 5.  Add a recipe manually (name + cuisine + meal type)
[ ] 6.  Import a recipe from AllRecipes URL
[ ] 7.  Add the imported recipe to this week's planner (Monday dinner)
[ ] 8.  Generate shopping list â€” ingredient appears under correct category
[ ] 9.  Add a pantry staple â€” activity feed updates
[ ] 10. Open Copilot, complete all 3 required steps, get recipe results
[ ] 11. Save a copilot recipe to the library
[ ] 12. Go to Profile â€” invite link is present (16 chars)
[ ] 13. Forgot password? â€” submit email, receive email (check inbox)
[ ] 14. Change password on Profile page
[ ] 15. Logout â†’ can't access /api/recipes â†’ login again with new password
```

---

## Section 13 â€” Known Gaps (Deferred)

These are documented non-blocking issues. Review before each major release to see if they've become blocking.

| Gap | Severity | Notes |
|-----|----------|-------|
| CSRF protection (SEC-010) | Medium | No CSRF tokens. SameSite=Lax on session cookie partially mitigates. Deferred post-launch. |
| Household routes use inline auth check | Low | `req.isAuthenticated()` inline in some routes instead of `requireAuth` middleware. Functionally identical, stylistically inconsistent. |
| Fuzzy ingredient dedup in shopping list | Low | "boneless chicken breast" vs "boneless, skinless chicken breast" â†’ two entries. Needs normalized comparison. |
| No email verification on register | Low | Users register without confirming email. Password reset works if they set a valid email. |
| AI cache unbounded growth | Low | `server/utils/cache.ts` has TTL but no max-size eviction. Under heavy load could leak memory. |
| Spoonacular fillIngredients:true | Low | Costs extra quota. Remove for count-only queries. |

---

## Appendix A â€” Test Data Recipes

Save these recipes in the test environment for deterministic shopping list testing:

**Recipe: Quick Pasta Carbonara**
- Ingredients: 2 cups pasta, 4 eggs, 1 cup parmesan cheese, 6 oz bacon, 2 tsp black pepper
- Expected categories: grains (pasta), dairy (eggs, parmesan), protein (bacon), pantry (black pepper)

**Recipe: Chicken Stir Fry**
- Ingredients: 1 lb chicken breast, 2 tbsp soy sauce, 1 tbsp sesame oil, 2 cloves garlic, 1 cup broccoli, 1 cup frozen corn
- Expected categories: protein (chicken), condiments (soy sauce), pantry (sesame oil, garlic powder), produce (garlic cloves, broccoli), frozen (frozen corn)

**Recipe: Crockpot Chili**
- Ingredients: 2 lbs ground beef, 1 can tomatoes, 2 tsp chili powder, 1 onion, 1 can kidney beans
- Expected: protein (beef), condiments (tomato paste), pantry (chili powder, canned beans), produce (onion)
- Expected auto-tags: crockpot (if "crockpot" in title), slow-cook (if â‰¥ 240 min)

---

## Appendix B â€” Regression Triggers

These are bugs that were fixed and must not regress. Each has an automated test â€” if the test breaks, the bug is back.

| Bug | Test | Commit |
|-----|------|--------|
| Plaintext password comparison still active post-bcrypt migration | `auth.test.ts: "post-upgrade password is a bcrypt hash"` | baefca3 |
| Reactions GET returned global data | `household-isolation.test.ts: "getReactionsForWeek called with householdId"` | baefca3 |
| Dev upgrade route reachable in production | `auth-guards.test.ts: "NODE_ENV production routes"` | baefca3 |
| Activity log leaked cross-household recipe names | `household-isolation.test.ts: "activity log scoped to household"` | 7c6527f |
| guessCategory: "garlic cloves" â†’ pantry (wrong) | `guess-category.test.ts: "garlic cloves â†’ produce"` | 7c6527f |
| guessCategory: "fish sauce" â†’ protein (wrong) | `guess-category.test.ts: "fish sauce â†’ condiments"` | 7c6527f |
| Copilot messageId not scoped to user (SEC-011) | `copilot-auth.test.ts: "updateProposedActionStatus scoped to userId+sessionId"` | 0084e54 |
| Shopping list O(nÂ²) recipe lookup | `shopping.tsx useMemo Map` â€” manual perf test with 500 recipes | 0c7e0b9 |

