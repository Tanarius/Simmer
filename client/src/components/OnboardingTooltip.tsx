import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Recipe } from "@shared/schema";
import { X } from "lucide-react";

const LS_PLANNER = "simmer_tooltip_planner_shown";
const LS_SHOPPING = "simmer_tooltip_shopping_shown";

export function OnboardingTooltip() {
  const { data: recipes } = useQuery<Recipe[]>({ queryKey: ["/api/recipes"] });
  const [tooltip, setTooltip] = useState<"planner" | "shopping" | null>(null);
  const prevCount = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show at most one tooltip at a time; only for users with few recipes
  useEffect(() => {
    const count = recipes?.length ?? null;
    if (count === null) return;

    // First render — record baseline, don't show
    if (prevCount.current === null) { prevCount.current = count; return; }

    const wasZero = prevCount.current === 0;
    prevCount.current = count;

    // First recipe saved → suggest Weekly Plan
    if (wasZero && count === 1 && !localStorage.getItem(LS_PLANNER)) {
      setTooltip("planner");
      timerRef.current = setTimeout(() => dismiss("planner"), 8_000);
    }
  }, [recipes?.length]); // eslint-disable-line

  function dismiss(which: "planner" | "shopping") {
    localStorage.setItem(which === "planner" ? LS_PLANNER : LS_SHOPPING, "1");
    setTooltip(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  if (!tooltip) return null;

  const COPY = {
    planner: { text: "Nice! Now plan your week →", href: "/#/planner" },
    shopping: { text: "Your shopping list is ready →", href: "/#/shopping" },
  }[tooltip];

  return (
    <div
      style={{
        position: "fixed",
        bottom: 88,
        left: 20,
        zIndex: 9000,
        maxWidth: 240,
        animation: "simmer-fade-in 200ms ease forwards",
      }}
    >
      <div
        style={{
          background: "#2A1F18",
          border: "1px solid #C96A3A",
          borderRadius: 12,
          padding: "12px 14px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(201,106,58,0.2)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {/* Arrow pointing left/up toward sidebar */}
        <div
          style={{
            position: "absolute",
            left: 18,
            bottom: "100%",
            width: 0,
            height: 0,
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderBottom: "7px solid #C96A3A",
            marginBottom: -1,
          }}
        />
        <a
          href={COPY.href}
          style={{ fontSize: 13, fontWeight: 700, color: "#F5EDE3", textDecoration: "none", flex: 1 }}
          onClick={() => dismiss(tooltip)}
        >
          {COPY.text}
        </a>
        <button
          onClick={() => dismiss(tooltip)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#9A8A7A" }}
        >
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>
    </div>
  );
}
