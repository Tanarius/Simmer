import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Users, Utensils, ChefHat, Coffee } from "lucide-react";

const DIETARY_OPTIONS = [
  { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "gluten-free", label: "Gluten-Free" },
  { id: "dairy-free", label: "Dairy-Free" },
  { id: "nut-free", label: "Nut-Free" },
];

const CUISINE_OPTIONS = [
  "American", "Italian", "Asian", "Tex-Mex", "Indian", "Mediterranean",
  "Japanese", "Korean", "French", "Middle Eastern", "Greek",
];

const COMPLEXITY_OPTIONS = [
  { value: "easy", label: "Easy weeknights only", desc: "30 min or less" },
  { value: "medium", label: "Mix of easy and involved", desc: "Up to 1 hour" },
  { value: "any", label: "Whatever looks good", desc: "No limit" },
];

export default function ProfilePage() {
  const { toast } = useToast();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["/api/profile"],
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Saved", description: "Household profile updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save profile.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const p = profile as any;
  const dietary: string[] = p?.dietaryRestrictions ? JSON.parse(p.dietaryRestrictions) : [];
  const cuisines: string[] = p?.likedCuisines ? JSON.parse(p.likedCuisines) : [];
  const householdSize: number = p?.householdSize ?? 1;
  const complexity: string = p?.complexityPreference ?? "medium";
  const breakfastEnabled: boolean = !!(p?.breakfastEnabled);

  const patchField = (field: string, value: unknown) => {
    mutation.mutate({ [field]: value });
  };

  const toggleArrayItem = (field: string, current: string[], item: string) => {
    const next = current.includes(item) ? current.filter(x => x !== item) : [...current, item];
    patchField(field, JSON.stringify(next));
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Household Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Tell the AI about your household so it can plan meals that work for everyone.</p>
      </div>

      {/* Household Size */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Household Size
          </CardTitle>
          <CardDescription>How many people are you shopping and cooking for?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => patchField("householdSize", Math.max(1, householdSize - 1))} disabled={householdSize <= 1}>−</Button>
            <span className="text-2xl font-semibold w-8 text-center">{householdSize}</span>
            <Button variant="outline" size="sm" onClick={() => patchField("householdSize", Math.min(12, householdSize + 1))} disabled={householdSize >= 12}>+</Button>
            <span className="text-sm text-muted-foreground ml-2">{householdSize === 1 ? "person" : "people"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Dietary Restrictions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Utensils className="h-4 w-4" /> Dietary Restrictions
          </CardTitle>
          <CardDescription>The AI will avoid recipes that don't meet these requirements.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {DIETARY_OPTIONS.map(opt => {
              const active = dietary.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleArrayItem("dietaryRestrictions", dietary, opt.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Liked Cuisines */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ChefHat className="h-4 w-4" /> Favorite Cuisines
          </CardTitle>
          <CardDescription>The AI will prioritize these when suggesting recipes and weekly plans.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {CUISINE_OPTIONS.map(c => {
              const active = cuisines.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleArrayItem("likedCuisines", cuisines, c)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-muted"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Complexity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ChefHat className="h-4 w-4" /> Recipe Complexity
          </CardTitle>
          <CardDescription>How much cooking effort does your household prefer?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {COMPLEXITY_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted transition-colors">
                <input
                  type="radio"
                  name="complexity"
                  value={opt.value}
                  checked={complexity === opt.value}
                  onChange={() => patchField("complexityPreference", opt.value)}
                  className="accent-primary"
                />
                <div>
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Breakfast Toggle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Coffee className="h-4 w-4" /> Breakfast Planning
          </CardTitle>
          <CardDescription>Add a breakfast slot to your weekly planner grid.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              id="breakfast-toggle"
              checked={breakfastEnabled}
              onCheckedChange={(val) => patchField("breakfastEnabled", val ? 1 : 0)}
            />
            <Label htmlFor="breakfast-toggle" className="text-sm">
              {breakfastEnabled ? "Breakfast planning enabled" : "Lunch & dinner only"}
            </Label>
          </div>
        </CardContent>
      </Card>

      {mutation.isPending && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving...
        </p>
      )}
    </div>
  );
}
