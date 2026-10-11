"use client";
// 50 squares by bucket; click scrolls to the row (parked squares open the parked list).
import type { Bucket } from "@/lib/types";

const LABEL: Record<Bucket, string> = { reach_out: "reach out", nudge: "nudge", parked: "parked" };

export function PipelineStrip({ items }: { items: { id: string; firm: string; bucket: Bucket }[] }) {
  const count = (b: Bucket) => items.filter((i) => i.bucket === b).length;
  const go = (id: string, bucket: Bucket) => {
    if (bucket === "parked") window.dispatchEvent(new CustomEvent("expand-parked"));
    requestAnimationFrame(() => {
      const el = document.getElementById(`row-${id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    });
  };
  return (
    <div>
      <ul className="strip" aria-label="Every investor on your list, grouped by what to do">
        {items.map((i) => (
          <li key={i.id}>
            <button type="button" className={`sq-${i.bucket}`} aria-label={`${i.firm}, ${LABEL[i.bucket]}`} title={i.firm} onClick={() => go(i.id, i.bucket)} />
          </li>
        ))}
      </ul>
      <ul className="legend">
        <li><span aria-hidden className="sq-reach_out" />Reach out {count("reach_out")}</li>
        <li><span aria-hidden className="sq-nudge" />Nudge {count("nudge")}</li>
        <li><span aria-hidden className="sq-parked" />Parked {count("parked")}</li>
      </ul>
    </div>
  );
}
