// Dashboard acceptance checks (docs/dashboard-design.md §13) against a URL:
// Playwright screenshots at 390x844 and 1440x900 with an above-the-fold check,
// axe-core on /, /vc/[id], /runs, reduced-motion check, Lighthouse (mobile).
// Uses the installed Google Chrome; nothing is downloaded.
//   npm run ui:check -- https://vc-pipeline-lovat.vercel.app
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium, type Page } from "playwright-core";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const OUT = "docs/proofs/ui";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

async function axe(page: Page) {
  await page.addScriptTag({ content: axeSource });
  const v = (await page.evaluate(async () => {
    // @ts-expect-error injected
    const r = await window.axe.run(document, { resultTypes: ["violations"] });
    return r.violations.map((x: { id: string; impact: string; nodes: unknown[] }) => ({ id: x.id, impact: x.impact, nodes: x.nodes.length }));
  })) as { id: string; impact: string; nodes: number }[];
  return { all: v, seriousOrCritical: v.filter((x) => x.impact === "serious" || x.impact === "critical") };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const report: Record<string, unknown> = { url: BASE, at: new Date().toISOString() };

  for (const [name, vp] of [["mobile-390x844", { width: 390, height: 844 }], ["desktop-1440x900", { width: 1440, height: 900 }]] as const) {
    const page = await browser.newPage({ viewport: vp });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${OUT}/home-${name}.png` });
    const fold = await page.evaluate((h) => {
      const vis = (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.top < h;
      };
      return { headline: vis("h1"), strip: vis(".strip"), topRow: vis(".row.top, .list .row") };
    }, vp.height);
    report[`aboveTheFold_${name}`] = fold;
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    report[`horizontalScroll_${name}`] = overflow;
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  report.axe_home = await axe(page);
  const firstVc = await page.getAttribute(".row a.firm", "href");
  if (firstVc) {
    await page.goto(`${BASE}${firstVc}`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${OUT}/vc-detail-desktop.png`, fullPage: true });
    report.axe_vc = await axe(page);
  }
  await page.goto(`${BASE}/runs`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/runs-desktop.png`, fullPage: true });
  report.axe_runs = await axe(page);

  // Every reach-out / nudge row has at least one source link that opens.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const links = await page.$$eval(".list .row", (rows) =>
    rows.map((r) => ({ firm: r.querySelector(".firm")?.textContent, href: r.querySelector("a.chip-src")?.getAttribute("href") ?? null })),
  );
  const linkChecks = [];
  for (const l of links) {
    if (!l.href || !/^https?:/.test(l.href)) {
      linkChecks.push({ ...l, status: l.href ? "internal" : "MISSING" });
      continue;
    }
    const res = await fetch(l.href, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15000) }).catch(() => null);
    linkChecks.push({ ...l, status: res ? res.status : "unreachable" });
  }
  report.sourceLinks = linkChecks;

  // Reduced motion disables tape animation.
  const rm = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await rm.goto(`${BASE}/`, { waitUntil: "networkidle" });
  report.reducedMotionAnimation = await rm.evaluate(() => getComputedStyle(document.querySelector(".tape span")!).animationName);
  await rm.close();
  await browser.close();

  // Lighthouse (mobile, default config).
  const { default: lighthouse } = await import("lighthouse");
  const chromeLauncher = await import("chrome-launcher");
  const chrome = await chromeLauncher.launch({ chromePath: CHROME, chromeFlags: ["--headless=new"] });
  const lh = await lighthouse(`${BASE}/`, { port: chrome.port, output: "html", onlyCategories: ["performance", "accessibility", "best-practices"] });
  await chrome.kill();
  if (lh) {
    writeFileSync(`${OUT}/lighthouse-mobile.html`, lh.report as string);
    report.lighthouse = Object.fromEntries(Object.entries(lh.lhr.categories).map(([k, c]) => [k, Math.round((c.score ?? 0) * 100)]));
  }

  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
