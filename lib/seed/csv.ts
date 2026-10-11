// Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF).
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((f) => f.trim() !== ""));
  if (!header) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

export interface SeedRow {
  id: string;
  firm: string;
  partner_name: string;
  region: string;
  investor_type: string;
  stage_focus: string;
  priority: "P1" | "P2" | "P3";
  seed_fit: string;
  b2b_logistics_fit: string;
  inclusion_evidence: string;
  evidence_source: string;
  website: string;
  website_verified: string;
  archived?: string; // "yes" for rows swapped out (kept, not tracked)
  archived_reason?: string;
}

export function toSeedRows(records: Record<string, string>[]): SeedRow[] {
  return records.map((r) => {
    const priority = r.priority;
    if (priority !== "P1" && priority !== "P2" && priority !== "P3") throw new Error(`bad priority for ${r.id}: ${priority}`);
    if (!r.id || !r.firm) throw new Error(`row missing id or firm: ${JSON.stringify(r)}`);
    return { ...(r as unknown as SeedRow), priority };
  });
}
