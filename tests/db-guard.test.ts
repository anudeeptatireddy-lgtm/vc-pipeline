// CLAUDE.md rule 2: nothing outside the RPCs may write to `vcs`.
// Static check over app code; the DB-level guarantee is the column grants
// tested in the §DB acceptance SQL.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["app", "components", "lib", "scripts"];
const WRITE_ON_VCS = /from\(\s*["']vcs["']\s*\)[\s\S]{0,200}?\.(update|upsert|delete)\s*\(/;

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

describe("manual columns guard", () => {
  it("no direct update/upsert/delete on vcs", () => {
    const offenders = ROOTS.flatMap(files).filter((f) => WRITE_ON_VCS.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("app/ and components/ never import write helpers", () => {
    const ui = ["app", "components"].flatMap(files).filter((f) => !f.startsWith(join("app", "api")));
    const offenders = ui.filter((f) => /from\s+["'](@\/lib\/db|\.\.?\/.*lib\/db)["']/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
