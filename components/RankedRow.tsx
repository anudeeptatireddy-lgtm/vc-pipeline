// RankedRow (`top` and `compact`) and nudge rows (dashboard-design.md §3.1, §4).
import Link from "next/link";
import type { DashboardRow } from "@/lib/queries";
import { ConfirmationBadge } from "./ConfirmationBadge";
import { CopyLineButton } from "./CopyLineButton";
import { FitLine } from "./FitLine";
import { FreshnessChip } from "./FreshnessChip";
import { SignalTape } from "./SignalTape";
import { SourceChips } from "./SourceChips";
import { YoursChip } from "./YoursChip";

export function RankedRow({
  row,
  rank,
  variant,
  kind,
}: {
  row: DashboardRow;
  rank?: number;
  variant: "top" | "compact";
  kind: "reach_out" | "nudge";
}) {
  const t = row.top;
  const line = kind === "nudge" ? (t?.nudgeLine ?? null) : (t?.openingLine ?? null);
  const top = variant === "top";
  return (
    <li id={`row-${row.id}`} className={`row clickable ${top ? "top" : "compact"}`}>
      <div className="row-head">
        {rank !== undefined && <span className="rank" aria-label={`Rank ${rank}`}>{rank}</span>}
        <Link className="firm display" href={`/vc/${row.id}`}>
          {row.firm}
        </Link>
        {row.partnerName && <span className="partner">{row.partnerName}</span>}
        {t && <FreshnessChip date={t.publishedDate} />}
      </div>
      <div className={rank !== undefined ? "row-body" : undefined}>
        <p className="reason">{t ? t.summary : "No recent public activity"}</p>
        {(top || kind === "nudge") && <SignalTape daysAgo={row.tapeDaysAgo} tone={kind === "nudge" ? "nudge" : "act"} />}
        {!top && kind === "reach_out" && <SignalTape daysAgo={row.tapeDaysAgo} size="sm" tone="act" />}
        {top && t && <FitLine fit={t.fit} relevance={t.relevance} />}
        <div className="row-foot">
          {t && <SourceChips sources={t.sources} vcId={row.id} />}
          {t && <ConfirmationBadge corroborated={t.corroborated} tier={t.tier} />}
          {kind === "nudge" && <YoursChip status={row.status} lastContactDate={row.lastContactDate} />}
          <span className="action">
            <CopyLineButton line={line} kind={kind === "nudge" ? "nudge" : "opening"} vcId={row.id} />
          </span>
        </div>
      </div>
    </li>
  );
}
