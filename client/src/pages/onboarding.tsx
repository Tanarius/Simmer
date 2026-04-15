import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ChevronRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const HOUSEHOLD_SIZES = [
  { value: 1, label: "Just Me",       emoji: "🧑‍🍳" },
  { value: 2, label: "Couple",         emoji: "👫" },
  { value: 4, label: "Small Family",   emoji: "👨‍👩‍👧",  sub: "3–4 people" },
  { value: 6, label: "Big Family",     emoji: "👨‍👩‍👧‍👦", sub: "5+ people" },
];

const COOKING_STYLES = [
  {
    value: "quick",
    label: "Quick & Easy",
    emoji: "⚡",
    desc: "Under 30 min. Fast weeknight meals when you don't have much time.",
  },
  {
    value: "classic",
    label: "Classic Cook",
    emoji: "🍳",
    desc: "30–60 min. Cooking fresh most nights with proper meals.",
  },
  {
    value: "crockpot",
    label: "Crockpot / Slow Cook",
    emoji: "🫕",
    desc: "Hands-off cooking. One recipe makes 4–6 portions — we'll spread them across your week automatically.",
  },
  {
    value: "meal-prep",
    label: "Meal Prep",
    emoji: "📦",
    desc: "Batch cook on weekends. One big cook feeds you all week — we'll plan your portions day by day.",
  },
];

const CUISINES = [
  { value: "tex-mex",        label: "Tex-Mex",        emoji: "🌮" },
  { value: "italian",        label: "Italian",        emoji: "🍝" },
  { value: "asian",          label: "Asian",          emoji: "🍜" },
  { value: "american",       label: "American",       emoji: "🍔" },
  { value: "mediterranean",  label: "Mediterranean",  emoji: "🥙" },
  { value: "indian",         label: "Indian",         emoji: "🍛" },
  { value: "other",          label: "Other",          emoji: "🌍" },
];

const DIETARY = [
  { value: "none",        label: "No restrictions" },
  { value: "vegetarian",  label: "Vegetarian" },
  { value: "vegan",       label: "Vegan" },
  { value: "gluten-free", label: "Gluten-free" },
  { value: "dairy-free",  label: "Dairy-free" },
  { value: "no-pork",     label: "No pork" },
  { value: "halal",       label: "Halal" },
];

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [householdSize, setHouseholdSize] = useState<number | null>(null);
  const [cookingStyles, setCookingStyles] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);

  const { data: state, isLoading } = useQuery<any>({ queryKey: ["/api/onboarding/state"] });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-violet-500" />
      </div>
    );
  }

  if (state?.completed) {
    setLocation("/");
    return null;
  }

  function toggleCookingStyle(val: string) {
    setCookingStyles(prev =>
      prev.includes(val) ? prev.filter(s => s !== val) : [...prev, val]
    );
  }

  function toggleCuisine(val: string) {
    setCuisines(prev =>
      prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]
    );
  }

  function toggleDietary(val: string) {
    if (val === "none") { setDietary(["none"]); return; }
    setDietary(prev => {
      const without = prev.filter(d => d !== "none");
      return without.includes(val) ? without.filter(d => d !== val) : [...without, val];
    });
  }

  async function finish(skip = false) {
    setSaving(true);
    try {
      await apiRequest("POST", "/api/onboarding/preferences", {
        householdSize: skip ? 2 : (householdSize ?? 2),
        cookingStyles: skip ? [] : cookingStyles,
        cuisines: skip ? [] : cuisines,
        dietary: skip ? [] : dietary.filter(d => d !== "none"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      setLocation("/");
      if (!skip) {
        toast({ title: "You're all set!", description: "Preferences saved — the AI will personalise your plan." });
      }
    } catch {
      toast({ description: "Failed to save preferences", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const canNext =
    (step === 1 && householdSize !== null) ||
    (step === 2 && cookingStyles.length > 0) ||
    (step === 3 && cuisines.length > 0) ||
    step === 4;

  function next() {
    if (step < TOTAL_STEPS) setStep(s => s + 1);
    else finish();
  }

  return (
    <div className="flex h-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-300",
                i < step ? "bg-violet-600" : "bg-muted"
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18 }}
          >

            {/* Step 1 — Household */}
            {step === 1 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-violet-500 mb-2">
                  Step 1 of {TOTAL_STEPS}
                </p>
                <h1 className="text-2xl font-bold mb-1">Who are you cooking for?</h1>
                <p className="text-sm text-muted-foreground mb-6">Used for default serving sizes</p>
                <div className="grid grid-cols-2 gap-3">
                  {HOUSEHOLD_SIZES.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setHouseholdSize(opt.value)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all",
                        householdSize === opt.value
                          ? "border-violet-500 bg-violet-500/10"
                          : "border-border bg-card hover:border-violet-500/40"
                      )}
                    >
                      <span className="text-3xl">{opt.emoji}</span>
                      <span className="text-sm font-semibold">{opt.label}</span>
                      {opt.sub && <span className="text-xs text-muted-foreground">{opt.sub}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2 — Cooking style */}
            {step === 2 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-violet-500 mb-2">
                  Step 2 of {TOTAL_STEPS}
                </p>
                <h1 className="text-2xl font-bold mb-1">How do you like to cook?</h1>
                <p className="text-sm text-muted-foreground mb-6">Select all that apply — we'll plan your week around this</p>
                <div className="space-y-3">
                  {COOKING_STYLES.map(opt => {
                    const selected = cookingStyles.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggleCookingStyle(opt.value)}
                        className={cn(
                          "w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all",
                          selected
                            ? "border-violet-500 bg-violet-500/10"
                            : "border-border bg-card hover:border-violet-500/40"
                        )}
                      >
                        <span className="text-2xl shrink-0 mt-0.5">{opt.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{opt.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{opt.desc}</p>
                        </div>
                        {selected && <Check className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 3 — Cuisines */}
            {step === 3 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-violet-500 mb-2">
                  Step 3 of {TOTAL_STEPS}
                </p>
                <h1 className="text-2xl font-bold mb-1">What cuisines do you love?</h1>
                <p className="text-sm text-muted-foreground mb-6">Pick as many as you want</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {CUISINES.map(c => {
                    const selected = cuisines.includes(c.value);
                    return (
                      <button
                        key={c.value}
                        onClick={() => toggleCuisine(c.value)}
                        className={cn(
                          "flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all",
                          selected
                            ? "border-violet-500 bg-violet-500/10"
                            : "border-border bg-card hover:border-violet-500/40"
                        )}
                      >
                        <span className="text-xl">{c.emoji}</span>
                        <span className="text-sm font-medium">{c.label}</span>
                        {selected && <Check className="h-3.5 w-3.5 text-violet-500 ml-auto shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 4 — Dietary */}
            {step === 4 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-violet-500 mb-2">
                  Step 4 of {TOTAL_STEPS}
                </p>
                <h1 className="text-2xl font-bold mb-1">Any dietary needs?</h1>
                <p className="text-sm text-muted-foreground mb-6">We'll filter suggestions accordingly</p>
                <div className="flex flex-wrap gap-2.5">
                  {DIETARY.map(opt => {
                    const selected = dietary.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggleDietary(opt.value)}
                        className={cn(
                          "px-4 py-2.5 rounded-full border-2 text-sm font-medium transition-all",
                          selected
                            ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                            : "border-border bg-card hover:border-violet-500/40"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* Footer */}
        <div className="flex items-center justify-between mt-8">
          <button
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => finish(true)}
            disabled={saving}
          >
            Skip setup
          </button>
          <Button
            onClick={next}
            disabled={!canNext || saving}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white gap-1.5 min-w-[120px]"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : step === TOTAL_STEPS ? (
              "Get Started"
            ) : (
              <>Continue <ChevronRight className="h-4 w-4" /></>
            )}
          </Button>
        </div>

      </div>
    </div>
  );
}
