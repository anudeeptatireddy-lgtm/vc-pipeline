// CLAUDE.md rule 2: nothing outside the two security-definer functions may
// change `vcs`. Static check over app code; the database-level guarantee is
// vc_runtime's grants (no UPDATE/DELETE on vcs), tested against Neon.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["app", "components", "lib", "scripts"];

function files(dir: string): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out = out.concat(files(path));
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

const src = (f: string) => readFileSync(f, "utf8");

describe("manual columns guard", () => {
  // scripts/proofs.ts deliberately ATTEMPTS these writes inside rolled-back
  // transactions to prove the database refuses them (R8), so it's exempt.
  const PROVES_DENIAL = new Set([join("scripts", "proofs.ts")]);

  it("no direct UPDATE or DELETE on vcs anywhere", () => {
    const re = /\b(update\s+(public\.)?vcs\b|delete\s+from\s+(public\.)?vcs\b)/i;
    expect(ROOTS.flatMap(files).filter((f) => !PROVES_DENIAL.has(f) && re.test(src(f)))).toEqual([]);
  });

  it("INSERT INTO vcs only in lib/db.ts (seeding new rows)", () => {
    const re = /insert\s+into\s+(public\.)?vcs\b/i;
    expect(ROOTS.flatMap(files).filter((f) => re.test(src(f)) && f !== join("lib", "db.ts"))).toEqual([]);
  });

  it("dashboard code has no write SQL (dashboard-design.md §13)", () => {
    const ui = ["app", "components"].flatMap(files).filter((f) => !f.startsWith(join("app", "api")) && !f.endsWith("actions.ts"));
    const re = /\b(insert\s+into|update\s+\w+\s+set|delete\s+from)\b|\.rpc\(/i;
    expect(ui.filter((f) => re.test(src(f)))).toEqual([]);
  });

  it("pages and components never import the write layer or the raw client", () => {
    const ui = ["app", "components"].flatMap(files).filter((f) => !f.startsWith(join("app", "api")) && !f.endsWith("actions.ts"));
    expect(ui.filter((f) => /from\s+["'](@\/lib\/(db|sql)|\.\.?\/.*lib\/(db|sql))["']/.test(src(f)))).toEqual([]);
  });
});
