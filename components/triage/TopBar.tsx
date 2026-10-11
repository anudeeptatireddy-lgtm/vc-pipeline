"use client";
// Top bar: logo, view tabs, status pill, search (/ or Cmd+K), demo, theme, Run now.
// On the home page the tabs switch views in place; elsewhere they link back home.
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Lane } from "@/lib/triage";
import { DemoButton } from "../DemoTour";
import { RunNowButton } from "../RunNowButton";
import { ThemeToggle } from "../ThemeToggle";
import { LANE_CHIP } from "./labels";

export type View = "focus" | "board" | "table" | "discover";
export const VIEWS: [View, string][] = [["focus", "Focus"], ["board", "Board"], ["table", "Table"], ["discover", "Discover"]];

export interface SearchItem {
  id: string;
  firm: string;
  partner: string | null;
  lane: Lane;
}

export interface Pill {
  text: string;
  warn: boolean;
}

export function TopBar({
  view,
  onView,
  items,
  onPick,
  pill,
  running,
}: {
  view?: View;
  onView?: (v: View) => void;
  items: SearchItem[];
  onPick?: (id: string) => void;
  pill: Pill;
  running: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pick = (id: string) => {
    setOpen(false);
    if (onPick) onPick(id);
    else router.push(`/?vc=${id}`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="bar">
      <div className="bar-in">
        <Link className="logo" href="/" aria-label="Pipeline, this week">
          <i aria-hidden><b /><b /><b /><b /></i>
          Pipeline
        </Link>
        <nav className="tabs" aria-label="Views" role={onView ? "tablist" : undefined}>
          {VIEWS.map(([v, label]) =>
            onView ? (
              <button key={v} type="button" className="tab" role="tab" aria-selected={view === v} aria-controls="view-panel" data-view={v} onClick={() => onView(v)}>
                {label}
              </button>
            ) : (
              <Link key={v} className="tab" href={v === "focus" ? "/" : `/?view=${v}`}>
                {label}
              </Link>
            ),
          )}
        </nav>
        <div className="sp" />
        <Link className="pill" href="/runs" title="Run history">
          <span className={`dot${pill.warn ? " warn" : ""}`} aria-hidden />
          <span className="t">{pill.text}</span>
          <span className="sr-only">. Open run history</span>
        </Link>
        <button type="button" className="btn search-btn" onClick={() => setOpen(true)} aria-label="Search investors" aria-keyshortcuts="/ Meta+K">
          <Search size={15} aria-hidden />
          <span className="lbl">Search</span> <span className="kbd" aria-hidden>/</span>
        </button>
        <DemoButton />
        <ThemeToggle />
        <RunNowButton running={running} />
      </div>
      {open && <SearchModal items={items} onPick={pick} onClose={() => setOpen(false)} />}
    </header>
  );
}

function SearchModal({ items, onPick, onClose }: { items: SearchItem[]; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const back = useRef<Element | null>(null);
  const results = items.filter((v) => !q || `${v.firm} ${v.partner ?? ""}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);

  useEffect(() => {
    back.current = document.activeElement;
    input.current?.focus();
    return () => (back.current as HTMLElement | null)?.focus?.();
  }, []);

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmd" role="dialog" aria-modal="true" aria-label="Search investors">
        <input
          ref={input}
          value={q}
          placeholder="Search by firm or partner"
          autoComplete="off"
          role="combobox"
          aria-expanded="true"
          aria-controls="search-results"
          aria-activedescendant={results[i] ? `sr-${results[i]!.id}` : undefined}
          onChange={(e) => {
            setQ(e.target.value);
            setI(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setI(Math.min(results.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setI(Math.max(0, i - 1));
            } else if (e.key === "Enter" && results[i]) onPick(results[i]!.id);
          }}
        />
        <ul id="search-results" role="listbox" aria-label="Investors">
          {results.length === 0 ? (
            <li><span className="none">No investor matches that.</span></li>
          ) : (
            results.map((v, n) => (
              <li key={v.id}>
                <button type="button" id={`sr-${v.id}`} role="option" aria-selected={n === i} onClick={() => onPick(v.id)} onMouseEnter={() => setI(n)}>
                  {v.firm}
                  <span>{LANE_CHIP[v.lane]}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="hint">Up and down to move, Enter to open, Esc to close</div>
      </div>
    </div>
  );
}
