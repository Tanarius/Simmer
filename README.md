# Simmer

**A household-first meal-planning app — built around the shared household as the primary unit, not a single-user app with sharing bolted on.**

🔗 **Live (early access):** [simmer.kitchen](https://simmer.kitchen)
🛠️ **Stack:** React + TypeScript · Express 5 · Drizzle ORM · PostgreSQL (Neon) · Anthropic API

---

## What it is

Food coordination in a household is fragmented: recipes live in screenshots and bookmarks, "what's for dinner this week" lives in a group chat, and the shopping list lives on someone's phone. None of it is connected.

Simmer is the shared place a household plans meals, manages recipes, and builds shopping lists together. Most meal-planning apps are single-user tools with a "share" button added later — their data model treats one person as the unit. Simmer treats the **household** as the unit from the schema up.

## Architecture at a glance

The spine of the system is **household isolation**: nearly all domain data (recipes, planned meals, shopping items) is scoped to a `householdId`, and that scoping is enforced at the data-access layer and covered by regression tests. A cross-household data leak is the worst-case bug in a multi-tenant app, so isolation is treated as a correctness and security property, not an afterthought.

```
Client (React/Vite PWA)
        │  session auth (Passport)
        ▼
Express 5 API ──► Drizzle ORM ──► PostgreSQL (Neon)
        │
        ├──► Anthropic API        (recipe extraction + conversational copilot)
        ├──► Spoonacular + TheMealDB  (recipe discovery, normalized + merged)
        └──► USDA FoodData Central    (packaged-food / snack data)
```

**Recipe acquisition** works three ways: manual entry, import from a URL/social post (server fetches the content, a model extracts a structured recipe — ingredients categorized by grocery aisle, times, cuisine, meal type), and import from a screenshot (client downsizes the image, server extracts the recipe).

**Recipe discovery** queries Spoonacular and TheMealDB in parallel, normalizes two different response shapes into one common model, filters by cuisine, and returns results the user can save into the household library or drop straight into the weekly plan.

## Tech stack

| Layer | Choices |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, Tailwind, shadcn/ui + Radix, Wouter routing, installable PWA |
| **Backend** | Express 5, TypeScript, Drizzle ORM, Passport.js (session auth) |
| **Database** | PostgreSQL (Neon, serverless) |
| **AI** | Anthropic API — a lightweight model for high-volume structured extraction, a stronger model for the conversational "Kitchen Copilot" |
| **External data** | Spoonacular (primary recipe search), TheMealDB (secondary), USDA FoodData Central |
| **Payments / email** | Stripe (subscription tiers), Resend (transactional, verified domain) |
| **Infra** | Railway (auto-deploy on `main`), Sentry (error monitoring) |

## Notable engineering decisions

**Household-first data model.** Rejected the common "build single-user, add sharing later" path — retrofitting multi-user onto a single-user schema is leaky, and the product thesis depends on the household being primary. The tradeoff is that every query and mutation must be household-scoped, which is a real correctness burden carried deliberately.

**Two-tier model selection.** Recipe import is high-volume structured extraction where a smaller, cheaper model is sufficient; the conversational copilot benefits from a stronger one. Routing each task to the right model by cost and capability keeps per-import cost down without compromising the conversational experience — at the price of two integration paths instead of one.

**Fixed the defect, didn't swap the vendor.** When recipe search returned wrong-cuisine results, the tempting move was to blame the data provider and pay for a premium tier. Investigation root-caused it to two bugs in the app's own secondary-source path — a key mismatch that silently fell back to a generic search, and results skipping the cuisine filter the primary source already applied. Switching providers would have spent money fixing nothing.

## Security & data integrity

A hardening pass shipped: a recipe-update mass-assignment guard, transactional account deletion, registration email validation and uniqueness enforcement, and password-reset email sent from a verified domain with the account-enumeration leak closed (uniform response whether or not an address exists).

## Known limitations & roadmap

Honest about current tech debt:
- **Migrations** — schema setup currently runs as boot-time DDL; moving to a formal migration system is the next infra task.
- **Test coverage** — the recipe-search path (where the most recent real bug lived) needs automated regression coverage.
- **Scale** — recipe search depends on a rate-limited third-party API; at higher volume this needs query caching and a paid tier. No load testing yet — current scale is early-access, not stress-validated.

## Project structure

```
client/   React front end (Vite, PWA)
server/   Express API, services, data access
shared/   Types and schema shared across client/server
script/   Dev and maintenance scripts
```

## Engineering approach

Built and maintained through a disciplined workflow: read-only investigation before edits, type-check and tests after every change, branch isolation, review via pull request, auto-deploy, then live verification.

---

*Simmer is in active early-access development. The live app is at [simmer.kitchen](https://simmer.kitchen).*
