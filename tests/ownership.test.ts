import { describe, expect, it } from "vitest";
import {
  deleteSql, insertFromJsonSql, insertSql, OwnershipError, pickColumns, SYSTEM_WRITE_COLUMNS, updateSql, USER_OWNED_VCS_COLUMNS, VCS_IDENTIFIER_COLUMNS, VCS_SIGNAL_COLUMNS,
} from "@/lib/ownership";

describe("system write allowlist", () => {
  it("keeps vcs out of the app's writable tables and user columns out of every write list", () => {
    expect(Object.keys(SYSTEM_WRITE_COLUMNS)).not.toContain("vcs");
    const vcsSystem = [...VCS_SIGNAL_COLUMNS, ...VCS_IDENTIFIER_COLUMNS] as string[];
    for (const c of USER_OWNED_VCS_COLUMNS) expect(vcsSystem).not.toContain(c);
  });

  it("builds explicit column lists", () => {
    expect(insertSql("vc_score_history", ["vc_id", "run_id", "follow_up_score", "recommended_action"])).toBe(
      "insert into public.vc_score_history (vc_id, run_id, follow_up_score, recommended_action) values ($1, $2, $3, $4)",
    );
    expect(updateSql("signals", ["classification_votes"], ["vc_id", "source_url"])).toBe(
      "update public.signals set classification_votes = $1 where vc_id = $2 and source_url = $3",
    );
    expect(insertFromJsonSql("signals", ["vc_id", "summary"], { conflict: ["vc_id", "source_url"], doNothing: true })).toBe(
      "insert into public.signals (vc_id, summary) select vc_id, summary from jsonb_populate_recordset(null::public.signals, $1::jsonb) on conflict (vc_id, source_url) do nothing",
    );
    expect(insertSql("vc_channels", ["vc_id", "pitch_url"], { conflict: ["vc_id"], update: ["pitch_url"] })).toContain(
      "on conflict (vc_id) do update set pitch_url = excluded.pitch_url",
    );
  });

  it("refuses user-owned, unknown and key columns", () => {
    // @ts-expect-error personal_notes is not a signals column
    expect(() => updateSql("signals", ["personal_notes"], ["id"])).toThrow(OwnershipError);
    // @ts-expect-error vcs is not a system table
    expect(() => updateSql("vcs", ["follow_up_score"], ["id"])).toThrow(OwnershipError);
    expect(() => updateSql("signals", ["summary"], ["summary"])).toThrow(/can't be used as a key/);
    expect(() => deleteSql("signals", ["id"])).toThrow(/can't be deleted/);
    expect(deleteSql("vc_contacts", ["vc_id"])).toBe("delete from public.vc_contacts where vc_id = $1");
  });

  it("picks only allowlisted fields from a row object (no full-row writes)", () => {
    const row = { vc_id: "x", summary: "s", personal_notes: "AUDIT NOTE 123", extra: 1 };
    expect(pickColumns("signals", row, ["vc_id", "summary"])).toEqual({ vc_id: "x", summary: "s" });
  });
});
