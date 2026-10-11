import { Lock } from "lucide-react";
import { daysSince } from "@/lib/format";
import type { VcStatus } from "@/lib/types";

export function YoursChip({ status, lastContactDate }: { status: VcStatus | null; lastContactDate: string | null }) {
  const text =
    status === "waiting_for_response"
      ? lastContactDate
        ? `Yours: waiting since ${daysSince(lastContactDate)} days`
        : "Yours: waiting on a reply"
      : "Yours: yet to reach out";
  return (
    <span className="chip chip-yours">
      <Lock size={12} aria-hidden />
      {text}
    </span>
  );
}
