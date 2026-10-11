import Link from "next/link";
import { istStamp, nextRun, shortStamp } from "@/lib/format";
import type { RunRow, RunState } from "@/lib/queries";
import { DemoButton } from "./DemoTour";
import { RunNowButton } from "./RunNowButton";
import { ThemeToggle } from "./ThemeToggle";

export function StatusBar({ state, lastGood, latest }: { state: RunState; lastGood: RunRow | null; latest: RunRow | null }) {
  const next = shortStamp(nextRun());
  const goodAt = lastGood?.finished_at ? istStamp(lastGood.finished_at).replace(" IST", "") : null;
  const sourceErrors = latest?.finished_at ? latest.errors.filter((e) => e.source).length : 0;
  return (
    <header className="status">
      <p className="status-text" style={{ margin: 0 }}>
        {state === "failed" ? (
          <>
            <span className="dot warn" aria-hidden />
            <span>{goodAt ? `Last run didn't finish. Showing data from ${goodAt}.` : "The last run didn't finish."}</span>
          </>
        ) : (
          <>
            <span className="dot ok" aria-hidden />
            <span>
              {lastGood?.finished_at ? `Live data. Updated ${istStamp(lastGood.finished_at)}. Next run ${next}.` : `Next run ${next}.`}
              {sourceErrors > 0 && (
                <>
                  {" "}
                  <Link className="status-link" href="/runs">Some sources didn&apos;t respond</Link>
                </>
              )}
            </span>
          </>
        )}
      </p>
      <div className="status-actions">
        <DemoButton />
        <ThemeToggle />
        <RunNowButton running={state === "running"} />
      </div>
    </header>
  );
}
