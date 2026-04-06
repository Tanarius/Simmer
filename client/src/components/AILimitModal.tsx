import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sparkles, Zap } from "lucide-react";
import { useLocation } from "wouter";

export function AILimitModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [, setLocation] = useLocation();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md border-t-4 border-t-purple-600 bg-black/95 text-white shadow-2xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent pointer-events-none" />
        <AlertDialogHeader className="relative z-10">
          <div className="mx-auto w-12 h-12 rounded-full bg-purple-600/20 flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 text-purple-400" />
          </div>
          <AlertDialogTitle className="text-2xl text-center font-bold text-white">Daily AI Limit Reached</AlertDialogTitle>
          <AlertDialogDescription className="text-center text-gray-400 mt-2">
            You've used all 5 of your free AI requests for today. Upgrade to MealPrep Premium for unlimited intelligent planning, recipe generation, and smart grocery organization.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="my-6 space-y-4 relative z-10 p-4 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-yellow-400 shrink-0" />
            <span className="text-sm font-medium text-gray-200">Unlimited AI Recipe Ideas</span>
          </div>
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-yellow-400 shrink-0" />
            <span className="text-sm font-medium text-gray-200">Advanced Weekly Meal Planning</span>
          </div>
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-yellow-400 shrink-0" />
            <span className="text-sm font-medium text-gray-200">Priority AI Suggestions</span>
          </div>
        </div>
        <AlertDialogFooter className="relative z-10 sm:justify-center flex-col sm:flex-col gap-2">
          <AlertDialogAction
            className="w-full bg-purple-600 hover:bg-purple-700 text-white border-0 py-6 text-lg transition-all hover:scale-[1.02]"
            onClick={() => {
              onOpenChange(false);
              setLocation("/pricing");
            }}
          >
            Upgrade to Premium
          </AlertDialogAction>
          <AlertDialogCancel onClick={() => onOpenChange(false)} className="w-full border-none bg-transparent hover:bg-white/10 text-gray-400 hover:text-white mt-0">
            Maybe Later
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
