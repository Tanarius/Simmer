import { useState } from "react";
import { Sparkles, Zap, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason?: string; // e.g. "You've used your 10 free AI messages today."
}

const PERKS = [
  "Unlimited recipe suggestions",
  "Unlimited Kitchen Copilot messages",
  "Unlimited weekly plan generation",
  "Unlimited social media screenshot imports",
  "Up to 6 household members",
  "Full activity feed history",
  "Nutrition data on recipes (coming soon)",
];

export function UpgradeModal({ open, onClose, reason }: UpgradeModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<"monthly" | "annual" | null>(null);

  async function handleUpgrade(plan: "monthly" | "annual") {
    setLoading(plan);
    try {
      const res = await apiRequest("POST", "/api/billing/create-checkout", { plan });
      const data = await res.json();
      if (data.error) {
        toast({ title: "Couldn't start checkout", description: data.error, variant: "destructive" });
        return;
      }
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Couldn't start checkout", description: err.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            Upgrade to Premium
          </DialogTitle>
        </DialogHeader>

        {reason && (
          <p className="text-sm text-muted-foreground -mt-1">{reason}</p>
        )}

        {/* Perks list */}
        <ul className="space-y-1.5 mt-1">
          {PERKS.map((perk) => (
            <li key={perk} className="flex items-center gap-2 text-sm">
              <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              {perk}
            </li>
          ))}
        </ul>

        {/* Pricing options */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <button
            onClick={() => handleUpgrade("monthly")}
            disabled={!!loading}
            className={cn(
              "rounded-xl border border-border p-4 text-left transition-colors hover:border-orange-500/50 hover:bg-orange-500/5",
              loading === "monthly" && "opacity-60 cursor-wait"
            )}
          >
            <p className="font-semibold text-base">$6 / month</p>
            <p className="text-xs text-muted-foreground mt-0.5">Cancel anytime</p>
          </button>

          <button
            onClick={() => handleUpgrade("annual")}
            disabled={!!loading}
            className={cn(
              "rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-left transition-colors hover:border-amber-500/70 hover:bg-amber-500/10 relative",
              loading === "annual" && "opacity-60 cursor-wait"
            )}
          >
            <span className="absolute -top-2.5 left-3 text-[10px] bg-amber-500 text-black px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
              Best value
            </span>
            <p className="font-semibold text-base">$49 / year</p>
            <p className="text-xs text-muted-foreground mt-0.5">$4.08/mo · save 32%</p>
          </button>
        </div>

        <p className="text-[11px] text-center text-muted-foreground">
          One subscription covers your entire household. Powered by Stripe — cancel anytime.
        </p>
      </DialogContent>
    </Dialog>
  );
}
