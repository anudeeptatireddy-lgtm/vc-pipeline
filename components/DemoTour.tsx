"use client";
// Guided demo: walks a viewer through finding a relevant investor, from the
// weekly answer to the drafted message, then the other views. It highlights real elements on the
// live pages and performs the clicks itself (shown with a ripple). Started by
// DemoButton via the "start-demo" event; mounted once in app/layout.tsx.
import { PlayCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { restoreTheme, snapshotTheme, type ThemeSnapshot } from "./ThemeToggle";

type Page = "home" | "runs";

interface Step {
  page: Page;
  target: string;
  title: string;
  body: string;
  /** Clicked by the tour when this step opens (e.g. expand a list). */
  clickOnArrive?: string;
  /** Clicked by the tour when the viewer presses Next (e.g. open an investor). */
  clickOnNext?: string;
}

const STEPS: Step[] = [
  {
    page: "home", target: ".bar-in",
    title: "Live data, twice a week",
    body: "Every Monday and Thursday at 08:00 IST the app checks 50 investors across news, web search, LinkedIn, podcasts, YouTube, SEC filings and the firms' own sites. The pill says how many sources answered and when.",
  },
  {
    page: "home", target: "h1.headline",
    title: "The answer comes first",
    body: "How many investors are worth a first message today. Only a score of 60 or more, with a confirmed fit, counts. Everything else is explained below it.",
  },
  {
    page: "home", target: ".yard-wrap",
    title: "Your whole list at a glance",
    body: "One square per investor. Amber: message today. Blue: you're waiting on a reply and they have news. Grey: maybe. Dark: parked. Hover for a name, click to open it, and use the chips to filter the list.",
  },
  {
    page: "home", target: ".queue",
    title: "Work through the queue",
    body: "Message today first, then follow-ups, then maybes. Parked investors stay folded away. Press j and k to move through it. Let's open the first one.",
    clickOnNext: ".queue .qi",
  },
  {
    page: "home", target: ".ws .why",
    title: "Why now",
    body: "The dated public signal behind the rank: for a deal, the company, round, size and their role; for an essay or talk, what and when. The last line says why it sits in this lane.",
  },
  {
    page: "home", target: ".ws .fit",
    title: "Does it fit you?",
    body: "Seed, B2B, logistics, software. A filled dot matches, half means partly or not stated, hollow means it doesn't. A row can only ask for a message when B2B and logistics are confirmed.",
  },
  {
    page: "home", target: ".ws .tape",
    title: "30 days in one line",
    body: "Each bar is a day, today on the right. Tall bars are days with public activity; amber ones are from the last week.",
  },
  {
    page: "home", target: ".ws .ev",
    title: "Every claim has a source",
    body: "Each item links to where it was published, with its date and link checked. When two separate sources report the same thing, it says so.",
  },
  {
    page: "home", target: ".ws .say",
    title: "A first line, ready to send",
    body: "An opening line (or a nudge line if you're waiting) written from the evidence. Copy it with the button or press c.",
  },
  {
    page: "home", target: ".ws .contacts",
    title: "Who to contact",
    body: "People from the firm's own team page, ordered by who decides: decision-maker, partner, principal, associate. LinkedIn, X and email appear only where the firm publishes them.",
  },
  {
    page: "home", target: ".ws .contacts .draft",
    title: "A message written for this person",
    body: "An email, a LinkedIn note under 300 characters, and a follow-up when you're waiting. Each uses the person's role and the firm's latest signal. Copy it, or open it in your email app. Nothing is sent for you.",
    clickOnArrive: ".ws .contacts:not(:has(.draft)) .drafts-btn",
  },
  {
    page: "home", target: ".ws .lock",
    title: "Your notes stay yours",
    body: "Your status, notes and contact history, next to the firm's profile and how the score works. The app never edits them.",
  },
  {
    page: "home", target: ".board",
    title: "Board",
    body: "The same investors as columns, one per lane. Click any tile to open it.",
    clickOnArrive: ".tab[data-view='board'][aria-selected='false']",
  },
  {
    page: "home", target: ".tbl-wrap",
    title: "Table",
    body: "All 50 in one table. Sort by any column and filter by name.",
    clickOnArrive: ".tab[data-view='table'][aria-selected='false']",
  },
  {
    page: "home", target: ".disc",
    title: "Discover",
    body: "Investors who aren't on your list but backed B2B logistics software at seed this year, ranked by the same rubric as your list, with their evidence.",
    clickOnArrive: ".tab[data-view='discover'][aria-selected='false']",
  },
  {
    page: "home", target: ".search-btn",
    title: "Find anyone fast",
    body: "Press / or Cmd+K to search by firm or partner from any page.",
    clickOnArrive: ".tab[data-view='focus'][aria-selected='false']",
  },
  {
    page: "runs", target: ".tbl-wrap",
    title: "Proof the data is live",
    body: "Every run: when it ran, how long it took, what each source found, and any errors.",
  },
  {
    page: "home", target: ".theme-toggle",
    title: "Light or dark",
    body: "Dark follows your system setting. Switch any time; the demo switches it now and puts it back at the end.",
    clickOnArrive: ".theme-toggle",
  },
  {
    page: "home", target: ".run-now",
    title: "Refresh whenever you like",
    body: "Run now checks all 50 investors again in about 4 minutes. That's the journey: see who's active, check the proof, pick the right person, send a message written for them.",
  },
];

const PAGE_PATH: Record<Page, string> = { home: "/", runs: "/runs" };
const onPage = (page: Page, path: string) => (page === "home" ? path === "/" : path === "/runs");

/** First matching element that is actually displayed. */
function find(sel: string): HTMLElement | null {
  try {
    for (const el of document.querySelectorAll<HTMLElement>(sel)) if (el.getClientRects().length) return el;
  } catch {}
  return null;
}

function ripple(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const dot = document.createElement("span");
  dot.className = "tour-click";
  dot.style.left = `${r.left + r.width / 2}px`;
  dot.style.top = `${r.top + r.height / 2}px`;
  document.body.appendChild(dot);
  setTimeout(() => dot.remove(), 700);
}

/** Target box, plus the right edge of the main column it sits in (the card goes beside the column). */
interface Box {
  r: DOMRect;
  columnRight: number;
}
const measure = (el: HTMLElement): Box => ({ r: el.getBoundingClientRect(), columnRight: el.closest(".queue, .band > div:first-child")?.getBoundingClientRect().right ?? 0 });

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function DemoTour() {
  const [step, setStep] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const rect = box?.r ?? null;
  const [busy, setBusy] = useState(false);
  const target = useRef<HTMLElement | null>(null);
  const startTheme = useRef<ThemeSnapshot | null>(null);
  const dir = useRef<1 | -1>(1);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const end = useCallback(() => {
    setStep(null);
    setBox(null);
    target.current = null;
    if (startTheme.current) restoreTheme(startTheme.current);
    startTheme.current = null;
  }, []);

  useEffect(() => {
    const start = () => {
      startTheme.current = snapshotTheme();
      dir.current = 1;
      setStep(0);
    };
    window.addEventListener("start-demo", start);
    return () => window.removeEventListener("start-demo", start);
  }, []);

  // Arrive at a step: go to its page, wait for its element, run its click, scroll to it.
  useEffect(() => {
    if (step === null) return;
    const s = STEPS[step]!;
    if (!onPage(s.page, pathname)) {
      router.push(PAGE_PATH[s.page]);
      return; // re-runs when pathname changes
    }
    let cancelled = false;
    (async () => {
      setBusy(true);
      if (s.clickOnArrive) {
        const c = find(s.clickOnArrive);
        if (c) {
          c.scrollIntoView({ block: "center" });
          await wait(250);
          ripple(c);
          await wait(350);
          c.click();
          await wait(300);
        }
      }
      let el: HTMLElement | null = null;
      for (let t = 0; t < 40 && !cancelled && !(el = find(s.target)); t++) await wait(150);
      if (cancelled) return;
      setBusy(false);
      if (!el) {
        // Not on this page today (e.g. no nudges): skip in the direction of travel.
        const n = step + dir.current;
        if (n >= 0 && n < STEPS.length) setStep(n);
        else end();
        return;
      }
      target.current = el;
      const tall = el.getBoundingClientRect().height > window.innerHeight * 0.6 || window.innerWidth < 640;
      el.style.scrollMarginTop = "84px";
      el.scrollIntoView({ block: tall ? "start" : "center", behavior: "smooth" });
      setBox(measure(el));
    })();
    return () => {
      cancelled = true;
    };
  }, [step, pathname, router, end]);

  // Keep the highlight on the element while the page scrolls, resizes or the element grows.
  useLayoutEffect(() => {
    if (step === null) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => target.current?.isConnected && setBox(measure(target.current)));
    };
    // The workspace scrolls on its own; listen to every scroll, not just the window's.
    const ro = new ResizeObserver(update);
    const watch = setInterval(() => {
      if (target.current) ro.observe(target.current);
    }, 300);
    window.addEventListener("scroll", update, { passive: true, capture: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(watch);
      ro.disconnect();
      window.removeEventListener("scroll", update, { capture: true });
      window.removeEventListener("resize", update);
    };
  }, [step]);

  const go = useCallback(
    async (d: 1 | -1) => {
      if (step === null || busy || !onPage(STEPS[step]!.page, pathname)) return;
      const n = step + d;
      if (n >= STEPS.length) return end();
      if (n < 0) return;
      dir.current = d;
      const s = STEPS[step]!;
      if (d === 1 && s.clickOnNext) {
        const c = find(s.clickOnNext);
        if (c) {
          ripple(c);
          await wait(450);
          target.current = null;
          setBox(null);
          c.click();
          await wait(200);
        }
      }
      if (STEPS[n]!.page !== s.page) {
        target.current = null;
        setBox(null);
      }
      setStep(n);
    },
    [step, busy, pathname, end],
  );

  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end();
      else if (e.key === "ArrowRight") void go(1);
      else if (e.key === "ArrowLeft") void go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, go, end]);

  const loading = step !== null && (busy || !onPage(STEPS[step]!.page, pathname));
  useEffect(() => {
    if (step !== null && !loading) nextBtn.current?.focus({ preventScroll: true });
  }, [step, loading]);

  if (step === null) return null;
  const s = STEPS[step]!;
  const pad = 6;

  // Card: right of the main column if there's room, then left of the target,
  // then below or above it, otherwise pinned to the bottom corner.
  let cardStyle: React.CSSProperties;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const W = Math.min(360, vw - 32);
  const H = 240;
  const right = Math.max(rect?.right ?? 0, box?.columnRight ?? 0) + 16;
  const y = (r: DOMRect) => Math.min(Math.max(r.top, 16), vh - H - 16);
  if (!rect || vw < 640) {
    cardStyle = { left: 16, right: 16, bottom: 16, width: "auto" };
  } else if (right + W <= vw - 16) {
    cardStyle = { left: right, top: y(rect), width: W };
  } else if (rect.left - 16 - W >= 16) {
    cardStyle = { left: rect.left - 16 - W, top: y(rect), width: W };
  } else if (rect.bottom + 12 + H <= vh) {
    cardStyle = { left: Math.min(Math.max(rect.left, 16), vw - W - 16), top: rect.bottom + 12, width: W };
  } else if (rect.top - 12 - H >= 0) {
    cardStyle = { left: Math.min(Math.max(rect.left, 16), vw - W - 16), top: rect.top - 12 - H, width: W };
  } else {
    cardStyle = { right: 16, bottom: 16, width: W };
  }

  return (
    <>
      <div className="tour-dim" aria-hidden style={rect ? { display: "none" } : undefined} />
      {rect && (
        <div
          className="tour-spot"
          aria-hidden
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      )}
      <div className="tour-card" role="dialog" aria-modal="false" aria-labelledby="tour-title" aria-describedby="tour-body" style={cardStyle}>
        <p className="small" aria-live="polite">
          Demo · step {step + 1} of {STEPS.length}
        </p>
        <h2 id="tour-title">{s.title}</h2>
        <p id="tour-body">{loading && !rect ? "Loading…" : s.body}</p>
        <div className="tour-progress" aria-hidden>
          <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <div className="tour-actions">
          <button type="button" className="btn btn-quiet" onClick={end}>End demo</button>
          <span style={{ flex: 1 }} />
          {step > 0 && <button type="button" className="btn" onClick={() => void go(-1)} disabled={loading}>Back</button>}
          <button ref={nextBtn} type="button" className="btn primary" onClick={() => void go(1)} disabled={loading}>
            {step === STEPS.length - 1 ? "Finish" : STEPS[step]!.clickOnNext ? "Click it" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}

export function DemoButton() {
  return (
    <button type="button" className="btn demo-btn" aria-label="Demo: a guided tour of the dashboard" onClick={() => window.dispatchEvent(new Event("start-demo"))}>
      <PlayCircle size={15} aria-hidden />
      <span className="lbl">Demo</span>
    </button>
  );
}
