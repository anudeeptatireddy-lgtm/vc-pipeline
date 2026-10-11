import type { SourceTier } from "@/lib/types";

export function ConfirmationBadge({ corroborated, tier }: { corroborated: boolean; tier: SourceTier }) {
  if (corroborated) return <span className="chip chip-ok">Confirmed by 2 sources</span>;
  if (tier === "D") return <span className="chip chip-unconfirmed">Unconfirmed, check the source</span>;
  return null;
}
