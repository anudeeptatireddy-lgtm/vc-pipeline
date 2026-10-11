"use client";
// Collapsed by default; never red (dashboard-design.md §4, §11).
import Link from "next/link";
import { useEffect, useState } from "react";

export interface ParkedItem {
  id: string;
  firm: string;
  lastSignalDate: string | null;
}

export function ParkedList({ items, defaultOpen = false }: { items: ParkedItem[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    const onExpand = () => setOpen(true);
    window.addEventListener("expand-parked", onExpand);
    return () => window.removeEventListener("expand-parked", onExpand);
  }, []);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="parked-h">
      <div className="parked-head">
        <p id="parked-h">{items.length} parked. No strong signal this month, so no need to spend time here.</p>
        <button type="button" className="btn" aria-expanded={open} aria-controls="parked-list" onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open && (
        <ul className="list" id="parked-list" style={{ marginTop: 12 }}>
          {items.map((p) => (
            <li key={p.id} id={`row-${p.id}`} className="parked-row clickable">
              <Link className="firm-link" href={`/vc/${p.id}`}>{p.firm}</Link>
              <span className="chip chip-quiet">Quiet</span>
              <span className="meta">{p.lastSignalDate ? `Last signal ${p.lastSignalDate}` : "No signal on record"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
