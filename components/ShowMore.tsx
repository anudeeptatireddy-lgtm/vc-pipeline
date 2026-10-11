"use client";
// Shows the first `initial` rows; "Show N more" expands the rest in place.
import { Children, useState, type ReactNode } from "react";

export function ShowMore({ children, initial = 3, label }: { children: ReactNode; initial?: number; label?: string }) {
  const items = Children.toArray(children);
  const [open, setOpen] = useState(false);
  const hidden = items.length - initial;
  return (
    <ul className="list" aria-label={label}>
      {open ? items : items.slice(0, initial)}
      {hidden > 0 && !open && (
        <li>
          <button type="button" className="more" style={{ borderTop: 0 }} onClick={() => setOpen(true)}>
            Show {hidden} more
          </button>
        </li>
      )}
    </ul>
  );
}
