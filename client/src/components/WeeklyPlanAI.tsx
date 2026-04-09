import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, Calendar } from "lucide-react";
import { AILimitModal } from "./AILimitModal";
import { useToast } from "@/hooks/use-toast";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function WeeklyPlanAI({ onPlanGenerated }: { onPlanGenerated: (plan: any) => void }) {
  const [open, setOpen] = useState(false);
  const [busyDays, setBusyDays] = useState<Record<string, boolean>>({});
  const [showLimitModal, setShowLimitModal] = useState(false);
  const { toast } = useToast();
  const { data: profile } = useQuery({ queryKey: ["/api/profile"], retry: false });
  const householdSize: number = (profile as any)?.householdSize ?? 1;

  const planMutation = useMutation({
    mutationFn: async (schedule: any[]) => {
      const res = await fetch("/api/ai/weekly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule }),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    },
    onSuccess: (data) => {
      setOpen(false);
      onPlanGenerated(data.weeklyPlan);
      toast({
        title: "AI Plan Ready",
        description: `Generated an optimized plan. ${data.callsRemaining !== 9999 ? `(${data.callsRemaining} AI calls remaining today)` : ''}`,
      });
    },
    onError: (err: any) => {
      if (err.upgradePrompt) {
        setOpen(false);
        setShowLimitModal(true);
      } else {
        toast({ title: "Failed", description: err.error || "An unknown error occurred", variant: "destructive" });
      }
    }
  });

  const handleGenerate = () => {
    const schedule = DAYS_OF_WEEK.map(day => ({
      dayOfWeek: day,
      isBusyDay: !!busyDays[day],
      peopleHome: householdSize,
    }));
    planMutation.mutate(schedule);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20">
            <Sparkles className="w-4 h-4 mr-2" />
            Generate AI Plan
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-500" />
              Configure Week
            </DialogTitle>
            <DialogDescription>
              Mark your busy days below. The AI will suggest quicker recipes (under 30 minutes) for those days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="flex items-center justify-between">
                <Label htmlFor={`busy-${day}`} className="text-base">{day}</Label>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground mr-2">{busyDays[day] ? "Busy" : "Normal"}</span>
                  <Switch
                    id={`busy-${day}`}
                    checked={!!busyDays[day]}
                    onCheckedChange={(c) => setBusyDays(prev => ({ ...prev, [day]: c }))}
                  />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={handleGenerate} disabled={planMutation.isPending} className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white">
              {planMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                "Generate Plan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AILimitModal open={showLimitModal} onOpenChange={setShowLimitModal} />
    </>
  );
}
