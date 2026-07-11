import { UpgradeModal } from "./UpgradeModal";

export function AILimitModal({
  open,
  onOpenChange,
  reason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: string;
}) {
  return (
    <UpgradeModal
      open={open}
      onClose={() => onOpenChange(false)}
      reason={reason ?? "You've reached your daily assistant limit."}
    />
  );
}
