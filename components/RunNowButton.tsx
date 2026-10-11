"use client";
// Run now: confirm dialog → runNow server action (no passcode). Progress is a checklist, not a bare spinner.
import { Check, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { runNow, type RunNowResult } from "@/app/actions";

const SOURCES = [
  "news and trade feeds", "web search", "LinkedIn (search index)", "podcasts", "YouTube",
  "SEC filings", "portfolio pages", "Gemini search",
];
const SOURCE_KEYS: Record<string, string> = {
  "batch-feeds": "news and trade feeds", "web-search": "web search", "linkedin-index": "LinkedIn (search index)",
  "podcast-index": "podcasts", youtube: "YouTube", "sec-form-d": "SEC filings",
  "portfolio-diff": "portfolio pages", "gemini-grounding": "Gemini search", "firm-rss": "news and trade feeds",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function RunNowButton({ running }: { running: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<RunNowResult | null>(null);
  const router = useRouter();

  if (running) {
    return (
      <button type="button" className="btn run-now" disabled>
        A run is in progress
      </button>
    );
  }

  const submit = () =>
    start(async () => {
      setResult(null);
      const r = await runNow();
      setResult(r);
      if (r.ok) {
        router.refresh();
        setTimeout(() => {
          for (const id of r.changedIds) document.getElementById(`row-${id}`)?.classList.add("flash");
        }, 600);
      }
    });

  const failed = result?.ok ? new Set(result.failedSources.map((s) => SOURCE_KEYS[s] ?? s)) : new Set<string>();

  return (
    <>
      <button type="button" className="btn run-now" onClick={() => dialog.current?.showModal()}>
        <RefreshCw size={14} aria-hidden />
        Run now
      </button>
      <dialog ref={dialog} aria-labelledby="run-h">
        <h2 id="run-h">Run now</h2>
        {!pending && !result?.ok && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <p style={{ margin: "8px 0 0" }}>Checks all 50 investors for new public activity. Takes about 4 minutes.</p>
            {result && !result.ok && <p className="meta" role="alert">{result.message}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => dialog.current?.close()}>Cancel</button>
              <button type="submit" className="btn btn-primary">Run now</button>
            </div>
          </form>
        )}
        {(pending || result?.ok) && (
          <>
            <ul className="checklist" aria-live="polite">
              {SOURCES.map((s) => (
                <li key={s}>
                  {pending ? <Loader2 size={14} className="spin" aria-hidden /> : <Check size={14} aria-hidden />}
                  {pending ? `Checking ${s}` : failed.has(s) ? `${cap(s)} didn't respond. The rest finished.` : cap(s)}
                </li>
              ))}
            </ul>
            {result?.ok && (
              <>
                <p role="status">Run finished. {result.newSignals} new signals.</p>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                  <button type="button" className="btn" onClick={() => { setResult(null); dialog.current?.close(); }}>Close</button>
                </div>
              </>
            )}
          </>
        )}
      </dialog>
    </>
  );
}
