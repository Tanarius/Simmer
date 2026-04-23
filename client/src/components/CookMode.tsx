import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Check, Timer, Users, Clock, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Recipe } from "@shared/schema";

interface CookModeProps {
  recipe: Recipe;
  onClose: () => void;
}

function parseSteps(recipe: Recipe): string[] {
  // Try cleanedSteps / sections first, fall back to instructions JSON
  try {
    if (recipe.cleanedSteps) {
      const cs = typeof recipe.cleanedSteps === "string" ? JSON.parse(recipe.cleanedSteps) : recipe.cleanedSteps;
      if (Array.isArray(cs) && cs.length > 0) {
        return cs.map((s: any) => (typeof s === "string" ? s : s.instruction ?? String(s))).filter(Boolean);
      }
    }
    if (recipe.sections) {
      const secs = typeof recipe.sections === "string" ? JSON.parse(recipe.sections) : recipe.sections;
      if (Array.isArray(secs)) {
        return secs.flatMap((sec: any) =>
          (sec.steps ?? []).map((st: any) => (typeof st === "string" ? st : st.instruction ?? String(st)))
        ).filter(Boolean);
      }
    }
  } catch { /* fall through */ }

  if (recipe.instructions) {
    try {
      const arr = JSON.parse(recipe.instructions);
      if (Array.isArray(arr)) return arr.filter(Boolean);
    } catch {
      return recipe.instructions.split(/\n+/).map(s => s.trim()).filter(Boolean);
    }
  }
  return ["No instructions available."];
}

function parseIngredients(recipe: Recipe): { name: string; amount: number; unit: string }[] {
  try {
    return JSON.parse(recipe.ingredients) ?? [];
  } catch { return []; }
}

// Simple countdown timer widget
function StepTimer() {
  const PRESETS = [5, 10, 15, 20, 30];
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!running) return;
    if (minutes === 0 && seconds === 0) { setRunning(false); setFinished(true); return; }
    const id = setInterval(() => {
      setSeconds(s => {
        if (s === 0) { setMinutes(m => m - 1); return 59; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, minutes, seconds]);

  const start = (mins: number) => { setMinutes(mins); setSeconds(0); setRunning(true); setFinished(false); };
  const stop = () => { setRunning(false); setMinutes(0); setSeconds(0); setFinished(false); };

  if (finished) return (
    <div className="flex items-center gap-2 text-green-500 font-semibold text-sm animate-pulse">
      <Timer className="h-4 w-4" /> Timer done!
      <button onClick={stop} className="text-xs text-muted-foreground underline ml-1">dismiss</button>
    </div>
  );

  if (running) return (
    <div className="flex items-center gap-3">
      <Timer className="h-4 w-4 text-orange-500" />
      <span className="text-2xl font-mono font-bold tabular-nums">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
      <button onClick={stop} className="text-xs text-muted-foreground underline">cancel</button>
    </div>
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Timer className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Set timer:</span>
      {PRESETS.map(m => (
        <button
          key={m}
          onClick={() => start(m)}
          className="text-xs px-2 py-0.5 rounded-full border border-border hover:border-primary hover:text-primary transition-colors"
        >
          {m}m
        </button>
      ))}
    </div>
  );
}

export function CookMode({ recipe, onClose }: CookModeProps) {
  const steps = parseSteps(recipe);
  const ingredients = parseIngredients(recipe);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [showIngredients, setShowIngredients] = useState(false);

  const prev = useCallback(() => setStep(s => Math.max(0, s - 1)), []);
  const next = useCallback(() => {
    setDone(d => new Set([...d, step]));
    setStep(s => Math.min(steps.length - 1, s + 1));
  }, [step, steps.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, onClose]);

  const progress = steps.length > 1 ? (step / (steps.length - 1)) * 100 : 100;
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Cook Mode</p>
            <p className="font-semibold text-sm truncate">{recipe.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
          {recipe.servings && (
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{recipe.servings}</span>
          )}
          {(recipe.prepTime || recipe.cookTime) && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {(recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)}m
            </span>
          )}
          <button
            onClick={() => setShowIngredients(v => !v)}
            className={cn("px-2.5 py-1 rounded-lg border text-xs transition-colors",
              showIngredients ? "border-primary text-primary bg-primary/5" : "border-border hover:border-primary/60"
            )}
          >
            Ingredients
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <Progress value={progress} className="h-1 rounded-none" />

      {/* Main content */}
      <div className="flex-1 overflow-auto flex flex-col items-center justify-center px-4 sm:px-8 py-6">
        <div className="w-full max-w-2xl">
          {/* Ingredients panel (collapsible) */}
          {showIngredients && ingredients.length > 0 && (
            <div className="mb-6 rounded-xl border border-border p-4 bg-muted/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ingredients</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {ingredients.map((ing, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-muted-foreground">{ing.amount > 0 ? `${ing.amount} ${ing.unit} ` : ""}</span>
                    <span>{ing.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step counter */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Step {step + 1} of {steps.length}
            </span>
            {done.has(step) && (
              <span className="flex items-center gap-1 text-xs text-green-500">
                <Check className="h-3 w-3" /> Done
              </span>
            )}
          </div>

          {/* Step text — large for easy reading */}
          <p className="text-2xl sm:text-3xl font-medium leading-relaxed tracking-tight text-foreground">
            {steps[step]}
          </p>

          {/* Timer */}
          <div className="mt-8">
            <StepTimer />
          </div>

          {/* Step dots */}
          <div className="flex flex-wrap gap-1.5 mt-8">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i === step ? "bg-primary w-4" : done.has(i) ? "bg-primary/40" : "bg-border hover:bg-muted-foreground"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="shrink-0 px-4 sm:px-8 py-4 border-t border-border bg-background">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={prev}
            disabled={step === 0}
            className="gap-2"
          >
            <ChevronLeft className="h-5 w-5" />
            Back
          </Button>

          {isLast ? (
            <Button
              size="lg"
              onClick={onClose}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white flex-1 max-w-xs"
            >
              <Flame className="h-5 w-5" />
              Done cooking!
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={next}
              className="gap-2 flex-1 max-w-xs"
            >
              Next step
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
