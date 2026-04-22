# MealPrep — Monetization Strategy

**Last updated:** 2026-04-16  
**Research basis:** Competitive analysis of Paprika, Plan to Eat, Mealime, Samsung Food (Whisk), AnyList, BigOven, Eat This Much

---

## Market Context

### What Competitors Charge

| App | Model | Price | Free Tier |
|-----|-------|-------|-----------|
| Paprika | One-time | $4.99 mobile / $29.99 desktop | 50-recipe limit, no cloud sync |
| Plan to Eat | Subscription | $5.95/mo or $49/yr | 14-day trial only — no permanent free |
| Mealime | Freemium | $2.99/mo | Core planning, limited recipe library |
| Samsung Food | Freemium | $6.99/mo or $59.99/yr | Basic planning, 2 tailored plans/mo |
| AnyList | Freemium | $9.99/yr individual, **$14.99/yr household** | Lists only (no recipe import, no planning) |
| BigOven | Freemium | $2.99/mo or $24.99/yr | 200-recipe limit, 1 scan/day |
| Eat This Much | Freemium | $5/mo (annual) or $14.99/mo | Daily plans only (no weekly) |

### The Market Gap

Almost no app prices explicitly for households. AnyList is the only outlier at $14.99/yr for 2–4 users — that's barely $1.25/user/month. Every other app charges per individual account but tacitly lets households share.

MealPrep is *built for households*. That's the differentiator and the pricing lever.

---

## Recommended Tier Structure

### Free Tier (generous — maximize top-of-funnel)

The goal of the free tier is to get a household using MealPrep until it's load-bearing — they're planning meals, the shopping list is working, the pantry is theirs. That's when they'll pay.

| Feature | Free Limit | Rationale |
|---------|-----------|-----------|
| Recipe library | Unlimited | Pain point if capped — users bounce |
| URL import | Unlimited | Discovery hook; more recipes = stickier |
| Social media import (caption paste) | Unlimited | Differentiator — let it spread |
| Social media import (screenshot) | 3/day | Costs Sonnet credits — reasonable gate |
| Manual planner | Unlimited | Core value; must be free |
| Shopping list generation | Unlimited | Core value |
| Pantry tracking | Unlimited | Low cost to serve |
| Kitchen Copilot messages | **10/day** | Down from current 20 — enough to taste it |
| AI recipe suggestions (Pantry Chef) | **3/day** | Down from current 5 |
| AI Weekly Plan generation | **2/week** | One per week is reasonable; second for re-rolls |
| Household members | Up to **3** | Covers most households; 4+ is premium |
| Activity feed | 7-day history | Premium gets full history |

### Premium — $6/month or $49/year ($4.08/mo)

Positioned as a household subscription. One payment covers the whole household (up to 6 members).

| Feature | Premium |
|---------|---------|
| Copilot messages | Unlimited |
| AI suggestions | Unlimited |
| AI Weekly Plan | Unlimited re-rolls |
| Social import screenshots | Unlimited |
| Household members | Up to 6 |
| Activity feed | Full history |
| Nutrition data | ✅ (future — via Spoonacular) |
| Recipe export (PDF) | ✅ (future) |
| Public recipe pages | ✅ (future) |
| Priority support | ✅ |

**Pricing rationale:** $6/mo is below Samsung Food's $6.99, competitive with Plan to Eat's $5.95, and feels cheap for a household (3 people = $2/person/month). Annual at $49 creates retention and pays roughly $4/mo — strong incentive to go annual.

### Why Not One-Time Purchase?

Paprika charges one-time but has no AI. AI costs money per call. A one-time model with unbounded AI usage doesn't work economically unless you charge $25+ upfront (which kills conversion). Subscription aligns cost with ongoing usage.

---

## Free → Paid Conversion Strategy

### Gate the right things

The features most likely to trigger upgrades are:
1. **AI rate limits** — hitting "You've used your 10 messages today" mid-planning session
2. **Household member cap** — trying to invite a 4th person (college apartment scenario)
3. **Screenshot import** — people love this feature once they try it; daily limit creates urgency

These gates are frustration-at-the-right-moment. The user already believes in the product when they hit them.

### What NOT to gate

- **Recipe import / URL** — this is how people populate their library. Gate this and they can't get to the point of caring about premium.
- **Shopping list** — same reason. If the shopping list doesn't work, the core loop is broken.
- **Planner** — same. Let them feel the value fully before asking to pay.

### Upgrade prompt design

Current: `429 with upgradePrompt: true` — a flag exists, upgrade UI needs to be built.

Recommended copy: *"You've used your 10 free AI messages today. Upgrade to Premium — $6/mo for the whole household, unlimited AI, cancel anytime."*

Inline upgrade should open a Stripe Checkout session — no redirect to a separate pricing page, one step.

---

## Revenue Projections (Conservative)

Assumptions: 1,000 MAU in month 6, 5% paid conversion, average $49/yr (annual plan).

| Metric | Value |
|--------|-------|
| Monthly Active Users | 1,000 |
| Paid conversion | 5% = 50 paying households |
| Average revenue per household | $49/yr = $4.08/mo |
| Monthly recurring revenue | ~$204/mo |
| Annual recurring revenue | ~$2,450 |

At 10,000 MAU with the same conversion: ~$24,500 ARR. These are conservative — meal planning apps that become habit-forming (weekly shopping list usage) have high retention. Plan to Eat reportedly has >60% annual renewal.

The ceiling without paid acquisition is driven by organic/invite growth. With Stripe and the invite mechanic already built, getting to 1,000 MAU is realistic within 3 months of launch.

---

## Highest-Leverage Revenue Additions (Prioritized)

### 1. Stripe Integration (launch blocker)

Build: 
- Checkout session endpoint: `POST /api/billing/create-checkout`
- Webhook handler: `POST /api/billing/webhook` — sets `subscriptionTier = 'premium'` on successful payment
- Portal endpoint: `POST /api/billing/portal` — Stripe Customer Portal for cancellation/upgrade

Use `stripe.checkout.sessions.create` with `mode: 'subscription'`, `price_data` pointing to the $6/mo or $49/yr price. After success, redirect to `/#/?upgraded=true` for confetti moment.

### 2. Grocery Delivery Affiliate (Phase 2)

Put Instacart/Kroger/Walmart affiliate links on shopping list items. User clicks an item → opens Instacart search pre-filled with that ingredient. Affiliate commission: ~2–5% of cart value.

Implementation: `getAffiliateUrl(ingredientName)` → `https://www.instacart.com/products?q=${encodeURIComponent(name)}&utm_source=mealprep`. Add a small basket icon on each shopping list item for premium users.

Revenue potential: if 10% of users click through once/week and average cart is $80, at 3% commission = $2.40/user/week = meaningful at scale.

### 3. Nutrition Data (Premium Differentiator)

Spoonacular's nutrition endpoint is already partially implemented (`enrichWithNutrition`). Surface macros (protein/carbs/fat/calories) on recipe cards and in the weekly plan totals for premium users.

This is a strong upgrade driver for the health-conscious segment — the subset of your users who meal prep specifically for fitness.

### 4. Public Recipe Pages / SEO (Growth)

Each recipe gets a public shareable URL: `/recipes/:id/public`. Renders recipe with structured data (JSON-LD schema.org/Recipe). Long-tail search traffic for "chicken tikka masala recipe", "crockpot chili recipe", etc.

This is a free growth channel with compounding returns. A user saves a recipe from Spoonacular, it becomes a public page, it ranks, a stranger finds it, signs up.

---

## Fair Free vs. Paid Split — The One-Line Answer

**Free should feel complete for a casual household. Paid should feel essential for a serious one.**

A household planning 3–4 dinners a week, using the copilot once or twice a week, inviting 2–3 people: that's free. A household doing full weekly AI planning every week, rebuilding their plan on Saturday, importing recipes from social media daily, with 5 members: that's premium. The gates should fall exactly between those two users.

---

## Implementation Priority

```
Phase 1 (LAUNCH BLOCKER):
  [ ] Stripe Checkout + Webhook + portal
  [ ] Upgrade prompt UI on 429 responses
  [ ] Premium tier badge on profile page

Phase 2 (POST-LAUNCH):
  [ ] Instacart affiliate links on shopping list
  [ ] Nutrition data on recipe cards (premium)
  [ ] Annual plan discount prompt at 3-month mark

Phase 3 (GROWTH):
  [ ] Public recipe pages (SEO)
  [ ] Shareable meal plan cards ("Plan with MealPrep")
  [ ] Referral credit system (invite 3 → 1 month free)
```
