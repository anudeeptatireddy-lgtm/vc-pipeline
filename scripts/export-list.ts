// Export the VC list to data/vc-list-export.xlsx: sheet "Active" and sheet
// "Archived", columns per the owner's spec.
//   npm run export:list
import ExcelJS from "exceljs";
import { loadAllVcs, loadVcProfiles } from "../lib/db";

const PLAIN: Record<string, string> = {
  leads_seed: "Leads seed", participates_seed: "Joins seed", series_a_plus_only: "Series A+ only", unknown: "Unknown",
  core: "Core (dedicated)", explicit: "Explicit in thesis", portfolio_only: "Portfolio only", none: "None",
  waiting_for_response: "Waiting for response", yet_to_reach_out: "Yet to reach out",
};

async function main() {
  const vcs = await loadAllVcs();
  const profiles = new Map((await loadVcProfiles()).map((p) => [p.vc_id, p]));
  const wb = new ExcelJS.Workbook();
  wb.creator = "VC Pipeline";
  const columns = [
    { header: "Firm", key: "firm", width: 30 },
    { header: "Partner", key: "partner", width: 24 },
    { header: "Region", key: "region", width: 18 },
    { header: "Priority", key: "priority", width: 9 },
    { header: "Status (yours, [DEMO])", key: "status", width: 22 },
    { header: "Seed fit", key: "seed", width: 16 },
    { header: "B2B logistics fit", key: "logistics", width: 22 },
    { header: "Evidence", key: "evidence", width: 70 },
    { header: "Website", key: "website", width: 32 },
    { header: "Archived", key: "archived", width: 10 },
  ];
  const sheet = (name: string, rows: typeof vcs, withReason: boolean) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = withReason ? [...columns, { header: "Archived reason", key: "reason", width: 40 }] : columns;
    for (const v of rows) {
      const p = profiles.get(v.id);
      ws.addRow({
        firm: v.firm, partner: v.partner_name ?? "", region: v.region ?? "", priority: v.priority ?? "",
        status: v.status ? PLAIN[v.status] : "", seed: p ? PLAIN[p.does_seed] : "", logistics: p ? PLAIN[p.b2b_logistics_thesis] : "",
        evidence: v.thesis ?? "", website: v.website ?? "", archived: v.archived ? "yes" : "no", reason: v.archived_reason ?? "",
      });
    }
    ws.getRow(1).font = { bold: true };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
    ws.getColumn("evidence").alignment = { wrapText: true, vertical: "top" };
  };
  const byPriority = (a: (typeof vcs)[number], b: (typeof vcs)[number]) => (a.priority ?? "P9").localeCompare(b.priority ?? "P9") || a.firm.localeCompare(b.firm);
  sheet("Active", vcs.filter((v) => !v.archived).sort(byPriority), false);
  sheet("Archived", vcs.filter((v) => v.archived).sort(byPriority), true);
  await wb.xlsx.writeFile("data/vc-list-export.xlsx");
  console.log(`wrote data/vc-list-export.xlsx: ${vcs.filter((v) => !v.archived).length} active, ${vcs.filter((v) => v.archived).length} archived`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
