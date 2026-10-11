"use client";
// Light/dark switch. Follows the system until clicked; the choice is kept in
// localStorage and applied before paint by the script in app/layout.tsx.
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const EVENT = "theme-change";

function current(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem("theme", t);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/** What the page had before the demo touched the theme, so it can be put back exactly. */
export interface ThemeSnapshot {
  attr: string | null;
  stored: string | null;
}

export function snapshotTheme(): ThemeSnapshot {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem("theme");
  } catch {}
  return { attr: document.documentElement.dataset.theme ?? null, stored };
}

export function restoreTheme(s: ThemeSnapshot) {
  if (s.attr) document.documentElement.dataset.theme = s.attr;
  else delete document.documentElement.dataset.theme;
  try {
    if (s.stored) localStorage.setItem("theme", s.stored);
    else localStorage.removeItem("theme");
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="btn btn-icon theme-toggle"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => setTheme(next)}
    >
      {theme === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </button>
  );
}
