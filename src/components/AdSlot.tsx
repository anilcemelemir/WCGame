import { Megaphone } from "lucide-react";

interface AdSlotProps {
  label: string;
  variant?: "banner" | "rail" | "interstitial";
}

export function AdSlot({ label, variant = "banner" }: AdSlotProps) {
  return (
    <aside className={`ad-slot ad-slot--${variant}`} aria-label={label}>
      <Megaphone size={18} aria-hidden="true" />
      <span>{label}</span>
    </aside>
  );
}
