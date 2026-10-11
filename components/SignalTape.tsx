// The dashboard's one memorable thing (dashboard-design.md §4, §5).
export function SignalTape({
  daysAgo,
  size = "md",
  tone = "act",
}: {
  daysAgo: number[];
  size?: "sm" | "md";
  tone?: "act" | "nudge" | "none";
}) {
  const hits = new Set(daysAgo.filter((d) => d >= 0 && d < 30));
  const recent = hits.size ? Math.min(...hits) : null;
  const label =
    hits.size === 0
      ? "No signals in the last 30 days"
      : `Signals on ${hits.size} of the last 30 days; most recent ${recent === 0 ? "today" : recent === 1 ? "yesterday" : `${recent} days ago`}`;
  // Oldest on the left, today on the right.
  const cells = Array.from({ length: 30 }, (_, i) => 29 - i);
  return (
    <div className={`tape ${size} ${tone} animate`} role="img" aria-label={label}>
      {cells.map((d, i) => (
        <span
          key={d}
          className={hits.has(d) ? (d <= 10 && tone !== "none" ? "hit hot" : "hit") : undefined}
          style={{ animationDelay: `${Math.round((i / 30) * 250)}ms` }}
        />
      ))}
    </div>
  );
}
