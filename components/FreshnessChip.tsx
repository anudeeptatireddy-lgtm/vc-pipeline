import { daysSince, freshness } from "@/lib/format";

export function FreshnessChip({ date }: { date: string }) {
  const n = daysSince(date);
  const tone = n <= 7 ? "recent" : n <= 14 ? "mid" : "old";
  return (
    <time className={`chip chip-fresh ${tone}`} dateTime={date}>
      {freshness(date)}
    </time>
  );
}
