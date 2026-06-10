import { useState, useMemo } from "react";
import { formatTime } from "@/lib/format-time";
import {
  ChevronLeft, ChevronRight, ShoppingCart, X, Calendar, Search, Clock, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DndContext, DragEndEvent, DragStartEvent, DragOverlay,
  useDraggable, useDroppable, PointerSensor, TouchSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import type { Recipe, WeeklyPlan, MealReaction } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { WeeklyPlanAI } from "@/components/WeeklyPlanAI";
import { getFoodEmoji, getCuisineGradient } from "@/lib/food-emoji";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed",
  thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};
const DAY_LABELS_FULL: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday",
  thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};
const REACTION_EMOJIS = ["❤️", "👍", "😂", "😋", "🤢"] as const;

const CUISINE_COLORS: Record<string, string> = {
  "tex-mex":       "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "italian":       "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  "asian":         "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "american":      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "mediterranean": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  "indian":        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  "other":         "bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-300",
};

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function formatWeekStart(date: Date) { return date.toISOString().split("T")[0]; }
function formatShortDate(monday: Date, i: number) {
  const d = new Date(monday); d.setDate(d.getDate() + i);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function parseTags(t: string | null | undefined): string[] {
  if (!t) return []; try { return JSON.parse(t); } catch { return []; }
}

type MealTime = "breakfast" | "lunch" | "dinner";
type MealSlotKey = `${typeof DAYS[number]}_${MealTime}`;
type MealValue = number | string;
type MealsMap = Partial<Record<MealSlotKey, MealValue>>;
type SlotMeta = { addedBy?: string };
type MealMetaMap = Partial<Record<string, SlotMeta>> & { notes?: Partial<Record<string, string>> };

const DAY_NAME_TO_ABBR: Record<string, typeof DAYS[number]> = {
  Monday: "mon", Tuesday: "tue", Wednesday: "wed",
  Thursday: "thu", Friday: "fri", Saturday: "sat", Sunday: "sun",
};

function aiPlanToMealsMap(aiPlan: any): MealsMap {
  const meals: MealsMap = {};
  for (const day of aiPlan?.days ?? []) {
    const abbr = DAY_NAME_TO_ABBR[day.dayOfWeek];
    if (!abbr) continue;
    if (day.lunch?.recipeName)  meals[`${abbr}_lunch`]  = day.lunch.recipeName;
    if (day.dinner?.recipeName) meals[`${abbr}_dinner`] = day.dinner.recipeName;
  }
  return meals;
}

// ─── Day Note ────────────────────────────────────────────────────────────────

function DayNote({ day, note, onSave }: { day: string; note: string; onSave: (text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note);

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        maxLength={60}
        onChange={e => setValue(e.target.value)}
        onBlur={() => { setEditing(false); onSave(value.trim()); }}
        onKeyDown={e => {
          if (e.key === "Enter") { setEditing(false); onSave(value.trim()); }
          if (e.key === "Escape") { setEditing(false); setValue(note); }
        }}
        className="w-full text-[10px] px-1 py-0.5 rounded border border-primary/50 bg-background text-foreground outline-none"
        placeholder="Add a note..."
        onClick={e => e.stopPropagation()}
      />
    );
  }

  return (
    <div
      onClick={e => { e.stopPropagation(); setEditing(true); setValue(note); }}
      className={cn(
        "text-[10px] px-1 py-0.5 rounded cursor-pointer truncate transition-colors text-center",
        note ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/30 hover:text-muted-foreground/60"
      )}
    >
      {note || "＋ note"}
    </div>
  );
}

// ─── Sidebar draggable recipe card ───────────────────────────────────────────

function DraggableRecipe({ recipe }: { recipe: Recipe }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe-${recipe.id}`,
    data: { recipe },
  });
  const emoji    = getFoodEmoji(recipe.name, recipe.cuisine);
  const gradient = getCuisineGradient(recipe.cuisine);
  const total    = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
  const [imgErr, setImgErr] = useState(false);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={undefined}
      className={cn(
        "flex gap-2 items-center p-1.5 rounded-lg border border-border bg-card cursor-grab",
        "hover:border-primary/60 hover:bg-accent/40 transition-colors touch-none select-none",
        isDragging && "opacity-30 pointer-events-none",
      )}
    >
      <div className="w-9 h-9 rounded shrink-0 overflow-hidden">
        {recipe.imageUrl && !imgErr ? (
          <img src={recipe.imageUrl} alt="" className="w-full h-full object-cover" onError={() => setImgErr(true)} />
        ) : (
          <div className={cn("w-full h-full bg-gradient-to-br flex items-center justify-center text-base", gradient)}>
            {emoji}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="text-xs font-medium truncate leading-tight">{recipe.name}</p>
        <div className="flex gap-1.5 items-center mt-0.5 flex-wrap">
          <span className={cn("text-[10px] px-1.5 py-px rounded-full capitalize font-medium", CUISINE_COLORS[recipe.cuisine] ?? CUISINE_COLORS.other)}>
            {recipe.cuisine}
          </span>
          {parseTags(recipe.tags).includes("crockpot") && (
            <span className="text-[10px] px-1.5 py-px rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">🥘</span>
          )}
          {total > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />{formatTime(total)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DragGhost({ recipe }: { recipe: Recipe }) {
  const emoji    = getFoodEmoji(recipe.name, recipe.cuisine);
  const gradient = getCuisineGradient(recipe.cuisine);
  return (
    <div className="flex gap-2 items-center p-1.5 rounded-lg border border-primary bg-card shadow-2xl w-44 opacity-95 rotate-1">
      <div className={cn("w-8 h-8 rounded shrink-0 bg-gradient-to-br flex items-center justify-center text-base", gradient)}>
        {emoji}
      </div>
      <p className="text-xs font-medium truncate">{recipe.name}</p>
    </div>
  );
}

// ─── Droppable slot ───────────────────────────────────────────────────────────

interface SlotProps {
  slotKey: MealSlotKey;
  label: string;
  mealValue: MealValue | null;
  recipes: Recipe[];
  onSet: (id: number) => void;
  onClear: () => void;
  isPending: boolean;
  onMobileTap?: () => void;
  onViewRecipe?: (id: number) => void;
  addedBy?: string;
  slotReactions: MealReaction[];
  currentUserId?: number;
  onReact: (slotKey: string, emoji: string | null) => void;
}

function DroppableSlot({ slotKey, label, mealValue, recipes, onSet, onClear, isPending, onMobileTap, onViewRecipe, addedBy, slotReactions, currentUserId, onReact }: SlotProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: slotKey });
  // Make filled slots draggable so they can be moved between days
  const { setNodeRef: setDragRef, listeners: dragListeners, attributes: dragAttributes, isDragging } = useDraggable({
    id: `slot-${slotKey}`,
    data: { fromSlot: slotKey },
    disabled: typeof mealValue !== "number",
  });
  const [open, setOpen] = useState(false);

  const recipe = typeof mealValue === "number" ? recipes.find(r => r.id === mealValue) ?? null : null;
  const aiName = typeof mealValue === "string" ? mealValue : null;

  const emoji    = recipe ? getFoodEmoji(recipe.name, recipe.cuisine) : "🍽️";
  const gradient = recipe ? getCuisineGradient(recipe.cuisine) : "from-zinc-400 to-zinc-600";
  const total    = recipe ? (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0) : 0;
  const [imgErr, setImgErr] = useState(false);

  useMemo(() => { setImgErr(false); }, [recipe?.id]);

  const mealEmoji = label === "Lunch" ? "☀️" : label === "Breakfast" ? "🌅" : "🌙";

  // Reaction helpers
  const reactionCounts = REACTION_EMOJIS.map(e => ({
    emoji: e,
    count: slotReactions.filter(r => r.emoji === e).length,
    isMe: slotReactions.some(r => r.emoji === e && r.userId === currentUserId),
  })).filter(r => r.count > 0);

  if (recipe || aiName) {
    const hasImg = !!recipe?.imageUrl && !imgErr;
    return (
      <div
        ref={node => { setDropRef(node); setDragRef(node); }}
        className={cn(
          "relative group rounded-xl overflow-hidden min-h-[88px] h-full transition-all",
          isOver && !isDragging && "ring-2 ring-primary scale-[1.02]",
          isDragging ? "opacity-30 cursor-grabbing" : recipe ? "cursor-grab" : "",
        )}
        data-testid={`slot-filled-${slotKey}`}
        onClick={!isDragging ? (onMobileTap ?? (recipe?.id != null ? () => onViewRecipe?.(recipe.id!) : undefined)) : undefined}
        {...(recipe ? dragListeners : {})}
        {...(recipe ? dragAttributes : {})}
      >
        {hasImg ? (
          <img src={recipe!.imageUrl!} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => setImgErr(true)} />
        ) : (
          <div className={cn("absolute inset-0 bg-gradient-to-br", recipe ? gradient : "from-stone-900 to-stone-800")} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />

        {/* Content */}
        <div className="relative p-2.5 flex flex-col h-full min-h-[88px]">
          <span className="text-[10px] font-medium text-white/70 uppercase tracking-wider">{mealEmoji} {label}</span>
          <div className="flex-1 flex flex-col justify-end gap-1 mt-1">
            {recipe ? (
              <div className="flex items-center gap-1 flex-wrap">
                <span className={cn("text-[10px] px-1.5 py-px rounded-full capitalize font-medium", CUISINE_COLORS[recipe.cuisine] ?? CUISINE_COLORS.other)}>
                  {recipe.cuisine}
                </span>
                {parseTags(recipe.tags).includes("crockpot") && (
                  <span className="text-[10px] px-1.5 py-px rounded-full font-medium bg-amber-500/80 text-white">🥘 Crockpot</span>
                )}
                {(parseTags(recipe.tags).includes("crockpot") || parseTags(recipe.tags).includes("slow-cook") || parseTags(recipe.tags).includes("make-ahead")) && (recipe.servings ?? 0) >= 4 && (
                  <span className="text-[10px] px-1.5 py-px rounded-full font-medium bg-blue-500/70 text-white" title="Makes multiple portions — great for batch cooking">📦 Batch</span>
                )}
              </div>
            ) : (
              <span className="text-[10px] px-1.5 py-px rounded-full w-fit bg-orange-500/50 text-orange-200 font-medium">AI</span>
            )}
            <p className="text-white text-xs font-semibold leading-snug line-clamp-2">{recipe ? recipe.name : aiName}</p>
            {recipe && total > 0 && (
              <span className="text-[10px] text-white/60 flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />{formatTime(total)}
              </span>
            )}
          </div>

          {/* Emoji reactions strip */}
          <div className="flex items-center gap-0.5 flex-wrap mt-1.5 min-h-[20px]">
            {reactionCounts.map(({ emoji: e, count, isMe }) => (
              <button
                key={e}
                onClick={ev => { ev.stopPropagation(); onReact(slotKey, isMe ? null : e); }}
                className={cn(
                  "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] border backdrop-blur-sm bg-black/50 transition-colors",
                  isMe ? "border-white/50 text-white" : "border-white/20 text-white/80 hover:border-white/40"
                )}
              >
                {e} <span>{count}</span>
              </button>
            ))}
            {/* + react picker */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  onClick={e => e.stopPropagation()}
                  className="flex items-center px-1.5 py-0.5 rounded-full text-[10px] border border-white/20 text-white/40 hover:text-white/70 bg-black/30 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  +
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-2 w-auto" side="top" onClick={e => e.stopPropagation()}>
                <div className="flex gap-1">
                  {REACTION_EMOJIS.map(e => {
                    const isMe = slotReactions.some(r => r.emoji === e && r.userId === currentUserId);
                    return (
                      <button
                        key={e}
                        onClick={() => onReact(slotKey, isMe ? null : e)}
                        className={cn("text-xl p-1.5 rounded hover:bg-muted transition-colors", isMe && "bg-muted ring-1 ring-primary")}
                      >
                        {e}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Attribution badge — top left */}
        {addedBy && (
          <div title={`Added by ${addedBy}`} className="absolute top-1 left-1 text-[9px] font-bold rounded-full bg-black/50 px-1.5 py-0.5 text-white/80 backdrop-blur-sm">
            {addedBy.slice(0, 2).toUpperCase()}
          </div>
        )}

        {/* Drag handle hint — shown on hover so users know the slot is draggable */}
        {recipe && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none select-none text-white text-xs">
            ⠿
          </div>
        )}

        {/* Remove — hover on desktop, always visible on touch */}
        <button
          onClick={e => { e.stopPropagation(); onClear(); }}
          disabled={isPending}
          className="absolute top-1 right-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity rounded-full p-1 bg-black/50 hover:bg-black/80"
          data-testid={`button-clear-slot-${slotKey}`}
        >
          <X className="h-3 w-3 text-white" />
        </button>
      </div>
    );
  }

  if (onMobileTap) {
    return (
      <div
        ref={setDropRef}
        className={cn(
          "rounded-xl min-h-[88px] h-full border-2 border-dashed transition-all cursor-pointer",
          "flex flex-col items-center justify-center gap-1",
          isOver
            ? "border-primary bg-primary/10 scale-[1.02]"
            : "border-border active:border-primary/50 active:bg-muted/40",
        )}
        onClick={onMobileTap}
        data-testid={`slot-empty-${slotKey}`}
      >
        <span className="text-base">{mealEmoji}</span>
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <Plus className="h-3.5 w-3.5 text-muted-foreground/60" />
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          ref={setDropRef}
          className={cn(
            "rounded-xl min-h-[88px] h-full border-2 border-dashed transition-all cursor-pointer",
            "flex flex-col items-center justify-center gap-1",
            isOver
              ? "border-primary bg-primary/10 scale-[1.02]"
              : "border-border hover:border-primary/50 hover:bg-muted/40",
          )}
          onClick={() => setOpen(true)}
          data-testid={`slot-empty-${slotKey}`}
        >
          <span className="text-base">{mealEmoji}</span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          <span className="text-[10px] text-muted-foreground/60">+ drop or pick</span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-72" align="start">
        <Command>
          <CommandInput placeholder="Search recipes..." data-testid={`input-search-slot-${slotKey}`} />
          <CommandEmpty>No recipes found.</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {recipes.map(r => (
              <CommandItem
                key={r.id}
                value={r.name}
                onSelect={() => { onSet(r.id); setOpen(false); }}
                className="flex items-center gap-2 cursor-pointer"
              >
                <span className={cn("shrink-0 text-[10px] px-1.5 py-px rounded-full capitalize font-medium", CUISINE_COLORS[r.cuisine] ?? CUISINE_COLORS.other)}>
                  {r.cuisine}
                </span>
                <span className="text-sm flex-1 truncate">{r.name}</span>
                {(r.prepTime ?? 0) + (r.cookTime ?? 0) > 0 && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatTime((r.prepTime ?? 0) + (r.cookTime ?? 0))}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlannerPage() {
  const [, setLocation] = useLocation();
  const [weekOffset, setWeekOffset] = useState(0);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [sidebarFilter, setSidebarFilter] = useState<"all" | "lunch" | "dinner">("all");
  const [activeDragRecipe, setActiveDragRecipe] = useState<Recipe | null>(null);
  const [mobilePickerSlot, setMobilePickerSlot] = useState<MealSlotKey | null>(null);
  const [mobileSearch, setMobileSearch] = useState("");
  const [showBreakfast, setShowBreakfast] = useState(() =>
    localStorage.getItem("mealplanner_breakfast") === "true"
  );
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const monday = useMemo(() => {
    const base = getMondayOfWeek(new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [weekOffset]);
  const weekStart = formatWeekStart(monday);

  const { data: recipes } = useQuery<Recipe[]>({ queryKey: ["/api/recipes"] });
  const { data: plan, isLoading } = useQuery<WeeklyPlan>({ queryKey: ["/api/plans", weekStart] });
  const { data: currentUser } = useQuery<any>({ queryKey: ["/api/user"], staleTime: 60_000 });
  const { data: reactions = [] } = useQuery<MealReaction[]>({
    queryKey: ["/api/plans", weekStart, "reactions"],
  });

  const currentMeals: MealsMap = useMemo(() => {
    if (!plan?.meals) return {};
    try { return JSON.parse(plan.meals); } catch { return {}; }
  }, [plan]);

  const currentMeta: MealMetaMap = useMemo(() => {
    const raw = (plan as any)?.mealMeta;
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {}; }
  }, [plan]);

  const savePlanMutation = useMutation({
    mutationFn: ({ meals, mealMeta }: { meals: MealsMap; mealMeta?: MealMetaMap }) =>
      apiRequest("POST", "/api/plans", {
        weekStart,
        meals: JSON.stringify(meals),
        ...(mealMeta !== undefined ? { mealMeta: JSON.stringify(mealMeta) } : {}),
      }).then(r => r.json()),
    onMutate: async ({ meals, mealMeta }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/plans", weekStart] });
      const prev = queryClient.getQueryData(["/api/plans", weekStart]);
      queryClient.setQueryData<WeeklyPlan>(["/api/plans", weekStart], old => ({
        ...(old ?? { id: 0, weekStart }),
        meals: JSON.stringify(meals),
        ...(mealMeta !== undefined ? { mealMeta: JSON.stringify(mealMeta) } : {}),
      } as WeeklyPlan));
      return { prev };
    },
    onError: (_e, _v, ctx: any) => {
      queryClient.setQueryData(["/api/plans", weekStart], ctx?.prev);
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["/api/plans", weekStart] }); },
  });

  const reactMutation = useMutation({
    mutationFn: ({ slotKey, emoji }: { slotKey: string; emoji: string | null }) =>
      apiRequest("POST", `/api/plans/${weekStart}/reactions`, { slotKey, emoji }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/plans", weekStart, "reactions"] }),
  });

  function setSlot(day: string, mealTime: MealTime, value: MealValue | null) {
    const key = `${day}_${mealTime}` as MealSlotKey;
    const updated = { ...currentMeals };
    const updatedMeta: MealMetaMap = { ...currentMeta };
    if (value === null) {
      delete updated[key];
      delete (updatedMeta as any)[key];
    } else {
      updated[key] = value;
      if (currentUser?.username) {
        (updatedMeta as any)[key] = { addedBy: currentUser.username };
      }
    }
    savePlanMutation.mutate({ meals: updated, mealMeta: updatedMeta });
  }

  function setDayNote(day: string, text: string) {
    const updatedMeta: MealMetaMap = { ...currentMeta };
    if (!updatedMeta.notes) updatedMeta.notes = {};
    if (text) {
      updatedMeta.notes[day] = text;
    } else {
      delete updatedMeta.notes[day];
    }
    savePlanMutation.mutate({ meals: currentMeals, mealMeta: updatedMeta });
  }

  function handleDragStart(event: DragStartEvent) {
    const sidebarRecipe = event.active.data.current?.recipe as Recipe | undefined;
    if (sidebarRecipe) {
      setActiveDragRecipe(sidebarRecipe);
    } else {
      // Slot drag — look up the recipe from the source slot key
      const fromSlot = event.active.data.current?.fromSlot as MealSlotKey | undefined;
      if (fromSlot) {
        const recipeId = currentMeals[fromSlot];
        setActiveDragRecipe(typeof recipeId === "number" ? (recipes?.find(r => r.id === recipeId) ?? null) : null);
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragRecipe(null);
    const { active, over } = event;
    if (!over) return;

    const toSlotKey = over.id as MealSlotKey;
    const fromSlotKey = active.data.current?.fromSlot as MealSlotKey | undefined;
    const sidebarRecipe = active.data.current?.recipe as Recipe | undefined;

    const updated: MealsMap = { ...currentMeals };
    const updatedMeta: MealMetaMap = { ...currentMeta };

    if (fromSlotKey) {
      // ── Slot → slot ──────────────────────────────────────────────────────
      if (fromSlotKey === toSlotKey) return; // dropped on itself
      const fromValue = currentMeals[fromSlotKey];
      if (typeof fromValue !== "number") return;
      const toValue = currentMeals[toSlotKey];
      // Place dragged recipe in destination
      updated[toSlotKey] = fromValue;
      if (currentUser?.username) (updatedMeta as any)[toSlotKey] = { addedBy: currentUser.username };
      if (toValue !== undefined) {
        // Destination was filled → swap
        updated[fromSlotKey] = toValue;
        if (currentUser?.username) (updatedMeta as any)[fromSlotKey] = { addedBy: currentUser.username };
      } else {
        // Destination was empty → move (clear source)
        delete updated[fromSlotKey];
        delete (updatedMeta as any)[fromSlotKey];
      }
    } else if (sidebarRecipe) {
      // ── Sidebar → slot ───────────────────────────────────────────────────
      updated[toSlotKey] = sidebarRecipe.id;
      if (currentUser?.username) (updatedMeta as any)[toSlotKey] = { addedBy: currentUser.username };
    } else {
      return;
    }

    savePlanMutation.mutate({ meals: updated, mealMeta: updatedMeta });
  }

  function quickFill() {
    if (!recipes) return;
    const updated: MealsMap = { ...currentMeals };
    const lunch   = recipes.filter(r => r.mealType !== "dinner");
    const dinner  = recipes.filter(r => r.mealType !== "lunch");
    const usedCuisines: string[] = Object.values(updated)
      .map(v => typeof v === "number" ? recipes.find(r => r.id === v)?.cuisine ?? "" : "")
      .filter(Boolean);
    for (const day of DAYS) {
      for (const [mealTime, pool] of [["lunch", lunch], ["dinner", dinner]] as const) {
        const key = `${day}_${mealTime}` as MealSlotKey;
        if (!updated[key]) {
          const fresh = pool.filter(r => !usedCuisines.slice(-3).includes(r.cuisine));
          const picks = fresh.length > 0 ? fresh : pool;
          if (picks.length > 0) {
            const pick = picks[Math.floor(Math.random() * picks.length)];
            updated[key] = pick.id;
            usedCuisines.push(pick.cuisine);
          }
        }
      }
    }
    savePlanMutation.mutate({ meals: updated });
    toast({ title: "Week filled!" });
  }

  const sidebarRecipes = useMemo(() => {
    if (!recipes) return [];
    return recipes.filter(r => {
      if (sidebarSearch && !r.name.toLowerCase().includes(sidebarSearch.toLowerCase())) return false;
      if (sidebarFilter === "lunch"  && r.mealType === "dinner") return false;
      if (sidebarFilter === "dinner" && r.mealType === "lunch")  return false;
      return true;
    });
  }, [recipes, sidebarSearch, sidebarFilter]);

  const totalSlots = showBreakfast ? 21 : 14;
  const plannedCount = Object.keys(currentMeals).length;
  const recipeIds    = [...new Set(Object.values(currentMeals).filter((v): v is number => typeof v === "number"))];

  const weekLabel = (() => {
    const end = new Date(monday); end.setDate(end.getDate() + 6);
    return `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  })();

  // Helper: build common slot props
  function slotSharedProps(day: string, mealTime: MealTime) {
    const key = `${day}_${mealTime}` as MealSlotKey;
    return {
      slotKey: key,
      mealValue: currentMeals[key] ?? null,
      recipes: recipes ?? [],
      onSet: (id: number) => setSlot(day, mealTime, id),
      onClear: () => setSlot(day, mealTime, null),
      isPending: savePlanMutation.isPending,
      addedBy: (currentMeta as any)[key]?.addedBy as string | undefined,
      slotReactions: reactions.filter(r => r.slotKey === key),
      currentUserId: currentUser?.id,
      onReact: (sk: string, emoji: string | null) => reactMutation.mutate({ slotKey: sk, emoji }),
    };
  }

  const mealTimes: MealTime[] = showBreakfast ? ["breakfast", "lunch", "dinner"] : ["lunch", "dinner"];
  const mealLabels: Record<MealTime, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full overflow-hidden">

        {/* ── Recipe Sidebar (desktop only) ── */}
        <div className="hidden md:flex w-52 flex-col border-r border-border bg-background shrink-0 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border space-y-2 shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recipes</p>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={sidebarSearch}
                onChange={e => setSidebarSearch(e.target.value)}
                className="pl-7 h-8 text-xs"
              />
            </div>
            <div className="flex gap-1">
              {(["all", "lunch", "dinner"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setSidebarFilter(f)}
                  className={cn(
                    "flex-1 text-[10px] py-1 rounded-md font-medium transition-colors",
                    sidebarFilter === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent",
                  )}
                >
                  {f === "all" ? "All" : f === "lunch" ? "☀️ Lunch" : "🌙 Dinner"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin p-2 space-y-1.5">
            {sidebarRecipes.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No recipes</p>
            ) : (
              sidebarRecipes.map(r => <DraggableRecipe key={r.id} recipe={r} />)
            )}
          </div>
          <div className="px-3 py-2 border-t border-border shrink-0">
            <p className="text-[10px] text-muted-foreground text-center">↑ Drag to a slot</p>
          </div>
        </div>

        {/* ── Main area ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* Header */}
          <div className="flex flex-col gap-2 px-4 sm:px-5 py-3 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold">Weekly Plan</h1>
                <p className="text-xs text-muted-foreground mt-0.5">{weekLabel}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setWeekOffset(o => o - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setWeekOffset(o => o + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border",
                plannedCount >= 8
                  ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-muted text-muted-foreground border-border",
              )}>
                <Calendar className="h-3 w-3" />
                {plannedCount} / {totalSlots} meals
                {plannedCount >= 8 && " ✓"}
              </div>
              {/* Breakfast toggle */}
              <button
                onClick={() => {
                  const next = !showBreakfast;
                  setShowBreakfast(next);
                  localStorage.setItem("mealplanner_breakfast", String(next));
                }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  showBreakfast
                    ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
                    : "bg-muted text-muted-foreground border-border hover:border-primary/40"
                )}
              >
                🌅 Breakfast
              </button>
              <WeeklyPlanAI onPlanGenerated={aiMeals => {
                // Read fresh plan data from cache to avoid stale closure
                const planData = queryClient.getQueryData<WeeklyPlan>(["/api/plans", weekStart]);
                const existingMeals: Record<string, MealValue> = planData?.meals
                  ? (() => { try { return JSON.parse(planData.meals); } catch { return {}; } })()
                  : {};
                // AI suggestions fill the base; existing numeric IDs always win
                const merged: MealsMap = { ...aiMeals };
                for (const [key, val] of Object.entries(existingMeals)) {
                  if (typeof val === "number") (merged as Record<string, MealValue>)[key] = val;
                }
                savePlanMutation.mutate({ meals: merged });
              }} />
              <Button variant="outline" size="sm" onClick={quickFill}>Quick Fill</Button>
              {recipeIds.length > 0 && (
                <Button asChild size="sm">
                  <Link href="/shopping">
                    <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />Shopping List
                  </Link>
                </Button>
              )}
              {plannedCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => savePlanMutation.mutate({ meals: {}, mealMeta: {} })}>
                  Clear All
                </Button>
              )}
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-hidden flex flex-col px-3 sm:px-5 py-4">
            {isLoading ? (
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 14 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            ) : (
              <>
                {/* Mobile: stacked day cards */}
                <div className="md:hidden flex-1 overflow-y-auto space-y-3">
                  {DAYS.map((day, di) => (
                    <div key={day} className="bg-card border border-border rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold">{DAY_LABELS_FULL[day]}</span>
                        <span className="text-xs text-muted-foreground">{formatShortDate(monday, di)}</span>
                      </div>
                      <DayNote
                        day={day}
                        note={currentMeta.notes?.[day] ?? ""}
                        onSave={text => setDayNote(day, text)}
                      />
                      <div className={cn("grid gap-2 mt-2", showBreakfast ? "grid-cols-3" : "grid-cols-2")}>
                        {mealTimes.map(mt => (
                          <DroppableSlot
                            key={mt}
                            label={mealLabels[mt]}
                            {...slotSharedProps(day, mt)}
                            onMobileTap={() => setMobilePickerSlot(`${day}_${mt}` as MealSlotKey)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: 7-column grid */}
                <div
                  className="hidden md:grid grid-cols-7 gap-2 flex-1"
                  style={{ gridTemplateRows: showBreakfast ? "auto auto 1fr 1fr 1fr" : "auto auto 1fr 1fr" }}
                >
                  {/* Day headers */}
                  {DAYS.map((day, di) => (
                    <div key={day} className="text-center">
                      <div className="text-xs font-semibold text-foreground">{DAY_LABELS[day]}</div>
                      <div className="text-[11px] text-muted-foreground mb-0.5">{formatShortDate(monday, di)}</div>
                    </div>
                  ))}
                  {/* Day notes row */}
                  {DAYS.map(day => (
                    <div key={`note-${day}`} className="mb-1">
                      <DayNote
                        day={day}
                        note={currentMeta.notes?.[day] ?? ""}
                        onSave={text => setDayNote(day, text)}
                      />
                    </div>
                  ))}
                  {/* Meal rows */}
                  {mealTimes.map(mt =>
                    DAYS.map(day => (
                      <DroppableSlot
                        key={`${day}_${mt}`}
                        label={mealLabels[mt]}
                        {...slotSharedProps(day, mt)}
                        onViewRecipe={(id) => {
                          sessionStorage.setItem("openRecipeId", String(id));
                          setLocation("/recipes");
                        }}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeDragRecipe ? <DragGhost recipe={activeDragRecipe} /> : null}
      </DragOverlay>

      {/* Mobile recipe picker — bottom sheet */}
      <Sheet open={!!mobilePickerSlot} onOpenChange={open => { if (!open) { setMobilePickerSlot(null); setMobileSearch(""); } }}>
        <SheetContent side="bottom" className="h-[82vh] flex flex-col rounded-t-2xl px-0 pb-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <SheetHeader className="px-4 pb-2 shrink-0">
            <SheetTitle className="text-base">
              {mobilePickerSlot ? (
                <>
                  {mobilePickerSlot.includes("lunch") ? "☀️ Lunch" : mobilePickerSlot.includes("breakfast") ? "🌅 Breakfast" : "🌙 Dinner"} ·{" "}
                  {DAY_LABELS_FULL[mobilePickerSlot.split("_")[0]]}
                  {currentMeals[mobilePickerSlot] && (
                    <button
                      className="ml-3 text-xs text-destructive font-normal"
                      onClick={() => {
                        const [d, mt] = mobilePickerSlot.split("_");
                        setSlot(d, mt as MealTime, null);
                        setMobilePickerSlot(null);
                      }}
                    >
                      Remove meal
                    </button>
                  )}
                </>
              ) : "Pick a recipe"}
            </SheetTitle>
          </SheetHeader>

          <div className="px-4 pb-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search recipes..."
                value={mobileSearch}
                onChange={e => setMobileSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {(() => {
              const filtered = (recipes ?? []).filter(r =>
                !mobileSearch || r.name.toLowerCase().includes(mobileSearch.toLowerCase())
              );
              if (filtered.length === 0) return (
                <p className="text-sm text-muted-foreground text-center py-8">No recipes found</p>
              );
              return (
                <div className="grid grid-cols-2 gap-3">
                  {filtered.map(r => {
                    const emoji2 = getFoodEmoji(r.name, r.cuisine);
                    const grad2  = getCuisineGradient(r.cuisine);
                    const total2 = (r.prepTime ?? 0) + (r.cookTime ?? 0);
                    const isCurrent = mobilePickerSlot ? currentMeals[mobilePickerSlot] === r.id : false;
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          if (mobilePickerSlot) {
                            const [d, mt] = mobilePickerSlot.split("_");
                            setSlot(d, mt as MealTime, r.id);
                            setMobilePickerSlot(null);
                            setMobileSearch("");
                          }
                        }}
                        className={cn(
                          "rounded-xl overflow-hidden border-2 text-left transition-all active:scale-95",
                          isCurrent ? "border-primary" : "border-transparent"
                        )}
                      >
                        <div className="relative h-28 w-full">
                          {r.imageUrl ? (
                            <img src={r.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                          ) : (
                            <div className={cn("absolute inset-0 bg-gradient-to-br flex items-center justify-center text-3xl", grad2)}>
                              {emoji2}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          {isCurrent && (
                            <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">✓</div>
                          )}
                        </div>
                        <div className="p-2 bg-card">
                          <p className="text-xs font-semibold leading-snug line-clamp-2 mb-1">{r.name}</p>
                          <div className="flex items-center gap-1.5">
                            <span className={cn("text-[10px] px-1.5 py-px rounded-full capitalize font-medium", CUISINE_COLORS[r.cuisine] ?? CUISINE_COLORS.other)}>
                              {r.cuisine}
                            </span>
                            {total2 > 0 && (
                              <span className="text-[10px] text-muted-foreground">{formatTime(total2)}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </SheetContent>
      </Sheet>
    </DndContext>
  );
}
