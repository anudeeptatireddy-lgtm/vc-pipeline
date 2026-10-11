// Dashboard home (docs/dashboard-design.md §3): triage layout over the SQL views.
// Read-only; the views (Focus, Board, Table, Discover) switch on the client.
import { Triage } from "@/components/triage/Triage";
import type { View } from "@/components/triage/TopBar";
import { istStamp, nextRun } from "@/lib/format";
import { getTriage } from "@/lib/queries";
import { sinceLine, statusPill } from "@/lib/status";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // the Run now server action runs the pipeline

const VIEWS: View[] = ["focus", "board", "table", "discover"];

export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string; vc?: string }> }) {
  const sp = await searchParams;
  const t = await getTriage();
  return (
    <Triage
      rows={t.rows}
      suggested={t.suggested}
      since={sinceLine(t)}
      pill={statusPill(t)}
      running={t.runState === "running"}
      nextUpdate={istStamp(nextRun())}
      initialView={VIEWS.includes(sp.view as View) ? (sp.view as View) : "focus"}
      initialVc={sp.vc ?? null}
    />
  );
}
