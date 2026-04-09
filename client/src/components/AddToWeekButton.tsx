/**
 * AddToWeekButton — appears on recipe cards in the library.
 * Opens a compact day × meal-time grid so the user can drop a recipe
 * straight into a specific slot in the current week's plan.
 */
import { useState, useMemo } from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed",
  thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};
const MEAL_ICONS: Record<string, string> = {
  breakfast: "☕", lunch: "☀️", dinner: "🌙",
};

type MealTime = "breakfast" | "lunch" | "dinner";
type MealSlotKey = `${typeof DAYS[number]}_${MealTime}`;
type MealsMap = Partial<Record<MealSlotKey, number>>;

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}
function formatWeekStart(d: Date) { return d.toISOString().split("T")[0]; }

interface Props {
  recipeId: number;
  recipeName: string;
}

export function AddToWeekButton({ recipeId, recipeName }: Props) {
  const [open, setOpen] = useState(false);
  const { toast }       = useToast();
  const queryClient     = useQueryClient();

  const weekStart = formatWeekStart(getMondayOfWeek(new Date()));

  const { data: profileData } = useQuery({ queryKey: ["/api/profile"], retry: false });
  const profile = profileData as any;
  const breakfastEnabled = !!profile?.breakfastEnabled;
  const mealSlots: MealTime[] = breakfastEnabled
    ? ["breakfast", "lunch", "dinner"]
    : ["lunch", "dinner"];

  const { data: planData } = useQuery({
    queryKey: ["/api/plans", weekStart],
    enabled: open,
    retry: false,
  });

  const currentMeals: MealsMap = useMemo(() => {
    if (!(planData as any)?.meals) return {};
    try { return JSON.parse((planData as any).meals); } catch { return {}; }
  }, [planData]);

  const savePlan = useMutation({
    mutationFn: (meals: MealsMap) =>
      apiRequest("POST", "/api/plans", { weekStart, meals: JSON.stringify(meals) }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans", weekStart] });
      toast({ title: "Added to plan", description: recipeName });
      setOpen(false);
    },
  });

  function pick(day: string, mt: MealTime) {
    const key = `${day}_${mt}` as MealSlotKey;
    savePlan.mutate({ ...currentMeals, [key]: recipeId });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="absolute bottom-1.5 right-1.5 h-7 w-7 bg-black/20 hover:bg-black/40
                     backdrop-blur-sm rounded-full transition-opacity"
          onClick={e => e.stopPropagation()}
          title="Add to week"
          data-testid={`button-add-to-week-${recipeId}`}
        >
          <CalendarPlus className="h-3.5 w-3.5 text-white" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="p-3 w-auto"
        align="end"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-xs font-semibold mb-2 text-foreground">Add to this week</p>
        <p className="text-[10px] text-muted-foreground mb-3 max-w-[200px] truncate">{recipeName}</p>

        {/* grid: rows = meal times, cols = days */}
        <div className="overflow-x-auto">
          <table className="text-[10px] border-collapse">
            <thead>
              <tr>
                <th className="pr-2 font-medium text-muted-foreground w-6"></th>
                {DAYS.map(d => (
                  <th key={d} className="px-1 pb-1 font-medium text-muted-foreground text-center w-9">
                    {DAY_LABELS[d]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mealSlots.map(mt => (
                <tr key={mt}>
                  <td className="pr-2 text-center py-0.5" title={mt}>
                    {MEAL_ICONS[mt]}
                  </td>
                  {DAYS.map(day => {
                    const key = `${day}_${mt}` as MealSlotKey;
                    const filled = !!currentMeals[key];
                    const isMe   = currentMeals[key] === recipeId;
                    return (
                      <td key={day} className="px-1 py-0.5 text-center">
                        <button
                          onClick={() => !filled && pick(day, mt)}
                          disabled={filled || savePlan.isPending}
                          className={cn(
                            "w-8 h-6 rounded transition-colors text-[9px] font-medium",
                            isMe
                              ? "bg-primary/20 text-primary border border-primary/40 cursor-default"
                              : filled
                              ? "bg-muted text-muted-foreground/40 cursor-not-allowed"
                              : "bg-muted hover:bg-primary hover:text-primary-foreground border border-border/50"
                          )}
                          title={filled ? (isMe ? "Already planned" : "Slot taken") : `Add to ${DAY_LABELS[day]} ${mt}`}
                        >
                          {isMe ? "✓" : filled ? "·" : "+"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[9px] text-muted-foreground mt-2">Grey slots are already filled · + to add</p>
      </PopoverContent>
    </Popover>
  );
}
