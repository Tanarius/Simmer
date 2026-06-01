import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import {
  ChefHat, ShoppingCart, Calendar, Sparkles,
  ChevronRight, CheckCircle2, Flame
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getFoodEmoji, getCuisineGradient } from "@/lib/food-emoji";
import type { Recipe, WeeklyPlan } from "@shared/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActivityEntry {
  id: number;
  userId: number;
  action: string;
  recipeId: number | null;
  recipeName: string | null;
  createdAt: string;
  username: string;
}

interface ShoppingItem {
  id: number;
  name: string;
  checked: boolean;
  category: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMondayOfWeek(date: Date): string {
  try {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

function compactTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 172800) return "yesterday";
    return format(d, "MMM d");
  } catch {
    return "";
  }
}

const ACTION_TEXT: Record<string, (name: string | null) => string> = {
  recipe_added:    (n) => `added ${n ? `"${n}"` : "a recipe"}`,
  recipe_deleted:  (n) => `removed ${n ? `"${n}"` : "a recipe"}`,
  pantry_added:    () => "added a pantry item",
  plan_meal_added: (n) => `added ${n ? `"${n}"` : "a meal"} to the plan`,
  plan_updated:    () => "updated the weekly plan",
};

const ACTION_COLOR: Record<string, string> = {
  recipe_added:    "bg-emerald-500",
  recipe_deleted:  "bg-red-400",
  pantry_added:    "bg-blue-400",
  plan_meal_added: "bg-orange-400",
  plan_updated:    "bg-amber-400",
};

const AVATAR_GRADIENTS = [
  "from-orange-600 to-amber-700",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-pink-500 to-rose-500",
  "from-blue-500 to-cyan-500",
];

function avatarGradient(username: string): string {
  let h = 0;
  for (const c of username) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QuickStat({ icon, label, value, href, accent }: {
  icon: React.ReactNode; label: string; value: string | number; href: string; accent?: string
}) {
  const [, setLocation] = useLocation();
  return (
    <button
      onClick={() => setLocation(href)}
      className="flex-1 min-w-[110px] flex flex-col items-start gap-1 p-4 rounded-2xl border border-border bg-card hover:bg-accent/40 transition-colors text-left"
    >
      <span className={cn("text-muted-foreground", accent)}>{icon}</span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  );
}

function PlanPreview({ plan, recipes }: { plan: WeeklyPlan | undefined; recipes: Recipe[] | undefined }) {
  const [, setLocation] = useLocation();

  const todaySlots = useMemo(() => {
    if (!plan?.meals) return [];
    try {
      const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const today = days[new Date().getDay()];
      const meals = JSON.parse(plan.meals);
      return (["lunch", "dinner"] as const).map(type => {
        const id = meals[`${today}_${type}`] as number | undefined;
        const recipe = recipes?.find(r => r.id === id);
        return { type, recipe };
      }).filter(s => s.recipe);
    } catch { return []; }
  }, [plan, recipes]);

  if (todaySlots.length === 0) return (
    <div className="rounded-2xl border border-dashed border-border p-5 text-center">
      <Calendar className="h-6 w-6 mx-auto mb-2 text-muted-foreground opacity-50" />
      <p className="text-sm text-muted-foreground">No meals planned for today</p>
      <Button variant="ghost" size="sm" onClick={() => setLocation("/planner")} className="mt-1 text-xs text-primary">
        Plan this week →
      </Button>
    </div>
  );

  return (
    <div className="space-y-2">
      {todaySlots.map(({ type, recipe }) => recipe && (
        <div
          key={type}
          className={cn("rounded-2xl p-4 flex items-center gap-3 bg-gradient-to-br", getCuisineGradient(recipe.cuisine ?? "other"))}
        >
          <span className="text-3xl shrink-0">{getFoodEmoji(recipe.name, recipe.cuisine)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white/60 capitalize">{type}</p>
            <p className="text-sm font-bold text-white truncate">{recipe.name}</p>
            {recipe.cookTime && (
              <p className="text-xs text-white/60 mt-0.5">{recipe.cookTime} min</p>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="shrink-0 h-8 px-3 text-xs bg-white/20 hover:bg-white/35 text-white border-0"
            onClick={() => {
              // Pass recipe ID to recipes page via sessionStorage so the dialog opens
              sessionStorage.setItem("openRecipeId", String(recipe.id));
              setLocation("/recipes");
            }}
          >
            <Flame className="h-3.5 w-3.5 mr-1" />
            Cook
          </Button>
        </div>
      ))}
    </div>
  );
}

function ShoppingNudge({ items }: { items: ShoppingItem[] }) {
  const [, setLocation] = useLocation();
  const unchecked = items.filter(i => !i.checked);
  const checked = items.filter(i => i.checked);

  if (items.length === 0) return null;

  const pct = items.length > 0 ? Math.round((checked.length / items.length) * 100) : 0;

  return (
    <button
      onClick={() => setLocation("/shopping")}
      className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:bg-accent/40 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Shopping list</span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {unchecked.length === 0
          ? <span className="text-green-500 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> All done!</span>
          : `${unchecked.length} item${unchecked.length !== 1 ? "s" : ""} left to get`
        }
      </p>
    </button>
  );
}

function ActivityPanel({ activity }: { activity: ActivityEntry[] }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Household activity</h2>
        <Badge variant="secondary" className="text-[10px]">live</Badge>
      </div>

      {activity.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Sparkles className="h-6 w-6 mb-2 opacity-40" />
          <p className="text-sm">No activity yet — start adding recipes!</p>
        </div>
      ) : (
        <div className="space-y-0.5 overflow-auto flex-1">
          {activity.slice(0, 20).map(entry => (
            <div key={entry.id} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-accent/30 transition-colors">
              <div className={cn("w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold shrink-0", avatarGradient(entry.username))}>
                {entry.username[0].toUpperCase()}
              </div>
              <span className={cn("w-2 h-2 rounded-full shrink-0", ACTION_COLOR[entry.action] ?? "bg-muted-foreground")} />
              <p className="text-sm flex-1 min-w-0">
                <span className="font-medium">{entry.username}</span>
                {" "}
                <span className="text-muted-foreground">
                  {(ACTION_TEXT[entry.action] ?? (() => entry.action))(entry.recipeName)}
                </span>
              </p>
              <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">{compactTime(entry.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [, setLocation] = useLocation();
  const weekStart = getMondayOfWeek(new Date());

  const { data: user } = useQuery<any>({ queryKey: ["/api/user"] });
  const { data: recipes } = useQuery<Recipe[]>({ queryKey: ["/api/recipes"] });
  const { data: plan } = useQuery<WeeklyPlan>({ queryKey: ["/api/plans", weekStart] });
  const { data: activity = [] } = useQuery<ActivityEntry[]>({
    queryKey: ["/api/activity"],
    queryFn: () => fetch("/api/activity", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 120_000,
  });
  const { data: shoppingItems = [] } = useQuery<ShoppingItem[]>({
    queryKey: ["/api/snacks/shopping"],
    queryFn: () => fetch("/api/snacks/shopping", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 120_000,
  });

  const plannedCount = useMemo(() => {
    if (!plan?.meals) return 0;
    try {
      const meals = JSON.parse(plan.meals);
      return new Set(Object.values(meals).filter(Boolean)).size;
    } catch { return 0; }
  }, [plan]);

  const shoppingUnchecked = shoppingItems.filter(i => !i.checked).length;

  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";
  const dateStr = (() => { try { return format(new Date(), "EEEE, MMMM d"); } catch { return ""; } })();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-auto">
        {/* ── Desktop 2-column / Mobile single-column layout ─── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">

            {/* ── Left column ───────────────────────────────────── */}
            <div className="space-y-6 min-w-0">

              {/* Greeting */}
              <div>
                <h1 className="text-2xl font-bold">
                  {greeting}{user?.username ? `, ${user.username}` : ""}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">{dateStr}</p>
              </div>

              {/* Quick stats */}
              <div className="flex gap-3">
                <QuickStat icon={<ChefHat className="h-4 w-4" />} label="recipes" value={recipes?.length ?? 0} href="/recipes" accent="text-emerald-500" />
                <QuickStat icon={<Calendar className="h-4 w-4" />} label="meals this week" value={plannedCount} href="/planner" accent="text-orange-500" />
                <QuickStat icon={<ShoppingCart className="h-4 w-4" />} label="items to get" value={shoppingUnchecked} href="/shopping" accent="text-orange-500" />
              </div>

              {/* Today's meals */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold">Today's meals</h2>
                  <button onClick={() => setLocation("/planner")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                    Full plan <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
                <PlanPreview plan={plan} recipes={recipes} />
              </div>

              {/* Shopping nudge */}
              {shoppingItems.length > 0 && <ShoppingNudge items={shoppingItems} />}

              {/* Activity feed on mobile (below main content) */}
              <div className="lg:hidden">
                <ActivityPanel activity={activity} />
              </div>
            </div>

            {/* ── Right column (desktop only) ──────────────────── */}
            <div className="hidden lg:flex flex-col bg-card border border-border rounded-2xl p-4 sticky top-6 max-h-[calc(100vh-96px)] overflow-hidden">
              <ActivityPanel activity={activity} />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
