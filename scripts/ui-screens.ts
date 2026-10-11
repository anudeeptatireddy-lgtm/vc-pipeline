// Screenshots of the dashboard at the three review sizes, both themes.
//   npx tsx scripts/ui-screens.ts <base-url> <out-dir> [label]
// Writes <out-dir>/<label>-<size>-<theme>.png (viewport) and -full.png (whole page).
// Uses the installed Chrome. If the URL is a protected Vercel preview, set
// VERCEL_AUTOMATION_BYPASS_SECRET and it is sent as the bypass header.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [base, out, label = "shot"] = process.argv.slice(2);
if (!base || !out) throw new Error("usage: ui-screens.ts <base-url> <out-dir> [label]");
mkdirSync(out, { recursive: true });

const SIZES = [
  { name: "1440x900", width: 1440, height: 900, themes: ["dark", "light"] as const },
  { name: "1920x1080", width: 1920, height: 1080, themes: ["dark", "light"] as const },
  { name: "390x844", width: 390, height: 844, themes: ["dark"] as const, mobile: true },
];
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
for (const s of SIZES) {
  for (const theme of s.themes) {
    const ctx = await browser.newContext({
      viewport: { width: s.width, height: s.height },
      colorScheme: theme,
      ...(s.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
      ...(bypass ? { extraHTTPHeaders: { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" } } : {}),
    });
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: "networkidle" });
    await page.waitForTimeout(900); // map load animation
    const file = `${out}/${label}-${s.name}-${theme}`;
    await page.screenshot({ path: `${file}.png` });
    await page.screenshot({ path: `${file}-full.png`, fullPage: true });
    const m = await page.evaluate(() => ({
      docH: document.documentElement.scrollHeight,
      bodyH: document.body.getBoundingClientRect().height,
      vh: innerHeight,
      htmlBg: getComputedStyle(document.documentElement).backgroundColor,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      hScroll: document.documentElement.scrollWidth > innerWidth,
    }));
    console.log(label, s.name, theme, JSON.stringify(m));
    await ctx.close();
  }
}
await browser.close();
