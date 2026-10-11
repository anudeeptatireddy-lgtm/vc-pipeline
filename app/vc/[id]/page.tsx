// One investor, full page (docs/dashboard-design.md §3.2). The same workspace as
// the Focus view, plus every signal on record. Read-only.
import { notFound } from "next/navigation";
import { InvestorPage } from "@/components/triage/InvestorPage";
import { getTriage, getVcDetail } from "@/lib/queries";
import { statusPill } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function VcPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, d] = await Promise.all([getTriage(), getVcDetail(id)]);
  const row = t.rows.find((r) => r.id === id);
  if (!row || !d) notFound();
  return (
    <InvestorPage
      row={row}
      signals={d.signals}
      items={t.rows.map((r) => ({ id: r.id, firm: r.firm, partner: r.partnerName, lane: r.lane }))}
      pill={statusPill(t)}
      running={t.runState === "running"}
    />
  );
}
