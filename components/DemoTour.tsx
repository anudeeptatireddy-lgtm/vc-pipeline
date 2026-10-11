"use client";
// Guided demo: walks a viewer through finding a relevant investor, from the
// weekly answer to the drafted message. It highlights real elements on the
// live pages and performs the clicks itself (shown with a ripple). Started by
// DemoButton via the "start-demo" event; mounted once in app/layout.tsx.
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { restoreTheme, snapshotTheme, type ThemeSnapshot } from "./ThemeToggle";

type Page = "home" | "vc" | "runs";

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
    page: "home", target: ".status",
    title: "Live data, twice a week",
    body: "Every Monday and Thursday at 08:00 IST the app checks 50 investors across news, web search, LinkedIn, podcasts, YouTube, SEC filings and the firms' own sites. This line says when it last ran.",
  },
  {
    page: "home", target: "h1.headline",
    title: "The answer comes first",
    body: "How many investors are worth a message this week. Everything below explains why.",
  },
  {
    page: "home", target: ".strip",
    title: "Your whole list at a glance",
    body: "One square per investor. Amber: reach out now. Blue: you're waiting on a reply and they have news. Grey: quiet this month. Clicking a square jumps to that investor; watch.",
    clickOnNext: ".strip .sq-reach_out",
  },
  {
    page: "home", target: ".row.top",
    title: "Your best lead this week",
    body: "Ranked by score: what the firm did in the last 30 days, how close it is to B2B logistics software at seed, and how recent it is. The chip on the right says how fresh the news is.",
  },
  {
    page: "home", target: ".row.top .tape",
    title: "30 days in one line",
    body: "Each bar is a day, today on the right. Tall bars are days with public activity; the coloured ones are from the last 10 days.",
  },
  {
    page: "home", target: ".row.top .fit",
    title: "Why it fits",
    body: "How the news matches the company raising: B2B customers, logistics, software, seed stage.",
  },
  {
    page: "home", target: ".row.top .row-foot a.chip-src",
    title: "Every claim has a source",
    body: "Click a chip to open the article it came from. Nothing is shown without a working link and a date in the last 30 days.",
  },
  {
    page: "home", target: ".row.top .action .btn",
    title: "A first line, ready to send",
    body: "Copies an opening line built from this signal, to paste into an email or a LinkedIn message.",
  },
  {
    page: "home", target: "section:has(#nudge-h)",
    title: "Investors you're waiting on",
    body: "You've contacted them and they have news since. The nudge line gives you a reason to follow up.",
  },
  {
    page: "home", target: ".rail-panels",
    title: "What changed, and who to add",
    body: "What moved since the last run, and active investors who aren't on the list yet, each with evidence.",
  },
  {
    page: "home", target: "section:has(#parked-h)",
    title: "Parked, for now",
    body: "Nothing relevant this month, so no need to spend time here. They move up as soon as they're active again.",
    clickOnArrive: "section:has(#parked-h) .btn[aria-expanded='false']",
  },
  {
    page: "home", target: ".row.top",
    title: "Open an investor",
    body: "Click anywhere on a box to see the full story. Let's open your best lead.",
    clickOnNext: ".row.top .firm",
  },
  {
    page: "vc", target: "h1.headline",
    title: "Why this investor, now",
    body: "The investor's page opens with the summary and the same 30-day tape.",
  },
  {
    page: "vc", target: ".timeline li",
    title: "Every signal, with proof",
    body: "What happened, when, the quote from the source and how it fits. Click the box to open the source.",
  },
  {
    page: "vc", target: "section:has(#contact-h)",
    title: "Who to contact",
    body: "People from the firm's own team page, ordered by who decides: decision-maker, partner, principal, associate. LinkedIn, X and email appear only where the firm publishes them.",
  },
  {
    page: "vc", target: "section:has(#contact-h) .list .panel",
    title: "A message written for this person",
    body: "An email, a LinkedIn note under 300 characters, and a follow-up when you're waiting. Each uses the person's role and the firm's latest signal. Copy it, or open it in your email app. Nothing is sent for you.",
    clickOnArrive: "section:has(#contact-h):not(:has(.list .panel)) .btn.action[aria-expanded='false']",
  },
  {
    page: "vc", target: ".rail",
    title: "The firm, and your notes",
    body: "Does it lead seed rounds, is logistics in its thesis, typical cheque. Your status and notes sit alongside; the app never changes them.",
  },
  {
    page: "vc", target: "section:has(#score-h)",
    title: "How the score works",
    body: "The maths behind the rank, signal by signal, so you can check it.",
  },
  {
    page: "runs", target: ".table-wrap",
    title: "Proof the data is live",
    body: "Every run: when it ran, how long it took, what each source found, and any errors.",
  },
  {
    page: "home", target: ".theme-toggle",
    title: "Light or dark",
    body: "Switch themes any time. The demo switches it now and puts it back at the end.",
    clickOnArrive: ".theme-toggle",
  },
  {
    page: "home", target: ".run-now",
    title: "Refresh whenever you like",
    body: "Run now checks all 50 investors again in about 4 minutes. That's the journey: see who's active, check the proof, pick the right person, send a message written for them.",
  },
];

const PAGE_PATH: Record<Page, (vc: string | null) => string> = { home: () => "/", vc: (vc) => vc ?? "/", runs: () => "/runs" };
const onPage = (page: Page, path: string) => (page === "home" ? path === "/" : page === "runs" ? path === "/runs" : path.startsWith("/vc/"));

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
const measure = (el: HTMLElement): Box => ({ r: el.getBoundingClientRect(), columnRight: el.closest(".main")?.getBoundingClientRect().right ?? 0 });

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function DemoTour() {
  const [step, setStep] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const rect = box?.r ?? null;
  const [busy, setBusy] = useState(false);
  const target = useRef<HTMLElement | null>(null);
  const vcPath = useRef<string | null>(null);
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
      vcPath.current = null;
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
      router.push(PAGE_PATH[s.page](vcPath.current));
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
      const r = el.getBoundingClientRect();
      const mobile = window.innerWidth < 640;
      const top = r.height > window.innerHeight * 0.6 || mobile ? window.scrollY + r.top - 72 : window.scrollY + r.top - (window.innerHeight - r.height) / 2;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
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
    const ro = new ResizeObserver(update);
    const watch = setInterval(() => {
      if (target.current) ro.observe(target.current);
    }, 300);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(watch);
      ro.disconnect();
      window.removeEventListener("scroll", update);
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
          if (c instanceof HTMLAnchorElement && c.pathname.startsWith("/vc/")) vcPath.current = c.pathname;
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
      if (!vcPath.current) {
        const a = document.querySelector<HTMLAnchorElement>(".row.top .firm");
        if (a) vcPath.current = a.pathname;
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
        <p className="meta" style={{ margin: 0 }} aria-live="polite">
          Demo · step {step + 1} of {STEPS.length}
        </p>
        <h2 id="tour-title" className="display" style={{ margin: "4px 0 6px", fontSize: 19, lineHeight: "24px" }}>{s.title}</h2>
        <p id="tour-body" style={{ margin: 0, fontSize: 15, lineHeight: "22px" }}>{loading && !rect ? "Loading…" : s.body}</p>
        <div className="tour-progress" aria-hidden>
          <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <div className="tour-actions">
          <button type="button" className="btn btn-quiet" onClick={end}>End demo</button>
          <span style={{ flex: 1 }} />
          {step > 0 && <button type="button" className="btn" onClick={() => void go(-1)} disabled={loading}>Back</button>}
          <button ref={nextBtn} type="button" className="btn btn-primary" onClick={() => void go(1)} disabled={loading}>
            {step === STEPS.length - 1 ? "Finish" : STEPS[step]!.clickOnNext ? "Click it" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}

export function DemoButton() {
  return (
    <button type="button" className="btn demo-btn" onClick={() => window.dispatchEvent(new Event("start-demo"))}>
      Demo
    </button>
  );
}
