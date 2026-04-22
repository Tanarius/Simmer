import { Link } from "wouter";
import { Sparkles, Zap, Users, ShoppingCart, Calendar, Camera, ChefHat, Check } from "lucide-react";
import { useState } from "react";
import { UpgradeModal } from "@/components/UpgradeModal";

const FEATURES = [
  {
    icon: <Sparkles className="h-5 w-5 text-amber-400" />,
    title: "AI Kitchen Copilot",
    desc: "Tell it what you're feeling — it finds recipes, learns your taste, and adapts to your household.",
  },
  {
    icon: <Calendar className="h-5 w-5 text-blue-400" />,
    title: "Weekly Meal Planner",
    desc: "Drag your saved recipes onto the week, or let AI fill the whole calendar in one click.",
  },
  {
    icon: <ShoppingCart className="h-5 w-5 text-green-400" />,
    title: "Smart Shopping Lists",
    desc: "Your plan becomes a categorized grocery list automatically — export, copy, or print it.",
  },
  {
    icon: <Camera className="h-5 w-5 text-pink-400" />,
    title: "Social Media Import",
    desc: "Screenshot a recipe from Instagram or TikTok — the AI extracts it into your library instantly.",
  },
  {
    icon: <Users className="h-5 w-5 text-purple-400" />,
    title: "Household Collaboration",
    desc: "Invite your partner, roommates, or family. Everyone plans together, nothing gets forgotten.",
  },
  {
    icon: <ChefHat className="h-5 w-5 text-orange-400" />,
    title: "Pantry Manager",
    desc: "Track what you have on hand so the shopping list skips what you already own.",
  },
];

const FREE_PERKS = [
  "10 AI Copilot messages per day",
  "3 AI weekly plan generations per day",
  "3 social media imports per day",
  "Up to 3 household members",
  "Unlimited recipes & meal planning",
  "Full shopping list & pantry",
];

const PREMIUM_PERKS = [
  "Unlimited AI Copilot messages",
  "Unlimited AI weekly plan generation",
  "Unlimited social media imports",
  "Up to 6 household members",
  "Full activity feed history",
  "Nutrition data (coming soon)",
];

export default function LandingPage() {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-bold text-lg">
          <span className="text-2xl">🍽️</span>
          MealPrep
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Sign in
          </Link>
          <Link
            href="/auth"
            className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 text-xs text-amber-400 font-medium mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          AI-powered meal planning
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-5 leading-tight">
          Plan your week's meals
          <br />
          <span className="text-primary">in minutes, not hours</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
          MealPrep combines an AI recipe assistant, drag-and-drop meal planner, and smart shopping lists — all shared with your household.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/auth"
            className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold text-base hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
          >
            Start for free →
          </Link>
          <button
            onClick={() => setUpgradeOpen(true)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
          >
            See Premium plans
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-4">No credit card required · Free forever plan available</p>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-10">Everything your household needs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-card border border-border rounded-2xl p-5 hover:border-border/80 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center mb-3">
                {f.icon}
              </div>
              <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-3xl mx-auto px-6 py-16" id="pricing">
        <h2 className="text-2xl font-bold text-center mb-2">Simple pricing</h2>
        <p className="text-center text-muted-foreground text-sm mb-10">One plan covers your entire household.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Free */}
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Free</p>
            <p className="text-3xl font-bold mb-1">$0</p>
            <p className="text-xs text-muted-foreground mb-6">Forever free</p>
            <ul className="space-y-2 flex-1 mb-6">
              {FREE_PERKS.map(p => (
                <li key={p} className="flex items-start gap-2 text-xs">
                  <Check className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                  {p}
                </li>
              ))}
            </ul>
            <Link
              href="/auth"
              className="block text-center py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Get started
            </Link>
          </div>

          {/* Premium */}
          <div className="bg-card border border-amber-500/40 rounded-2xl p-6 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-orange-500" />
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1">Premium</p>
            <p className="text-3xl font-bold mb-1">$6<span className="text-lg font-normal text-muted-foreground"> / mo</span></p>
            <p className="text-xs text-muted-foreground mb-6">or $49/year · save 32%</p>
            <ul className="space-y-2 flex-1 mb-6">
              {PREMIUM_PERKS.map(p => (
                <li key={p} className="flex items-start gap-2 text-xs">
                  <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                  {p}
                </li>
              ))}
            </ul>
            <button
              onClick={() => setUpgradeOpen(true)}
              className="block w-full text-center py-2.5 rounded-xl bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition-colors"
            >
              Upgrade to Premium
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-8">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} MealPrep. All rights reserved.</span>
          <div className="flex items-center gap-5">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/auth" className="hover:text-foreground transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}
