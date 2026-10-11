// SEC EDGAR Form D full-text search for US funds (docs/signal-sources.md §5.1).
// A new Form D from the firm = a fund raise = fresh capital to deploy.
import { z } from "zod";
import type { RawItem, SignalSource } from "../types";

const Hits = z.object({
  hits: z.object({
    hits: z.array(
      z.object({
        _id: z.string(),
        _source: z.object({
          ciks: z.array(z.string()),
          display_names: z.array(z.string()),
          file_date: z.string(),
          form: z.string().optional(),
          adsh: z.string().optional(),
        }),
      }),
    ),
  }),
});

export const secEnabled = () => {
  const ua = process.env.SEC_USER_AGENT ?? "";
  return !!ua && !ua.includes("example.com");
};

export function parseFormD(json: unknown, firmName: string): RawItem[] {
  const want = firmName.toLowerCase();
  return Hits.parse(json)
    .hits.hits.filter((h) => h._source.display_names.some((n) => n.toLowerCase().includes(want)))
    .map((h) => {
      const cik = h._source.ciks[0]!.replace(/^0+/, "");
      const adsh = h._source.adsh ?? h._id.split(":")[0]!; // e.g. 0001234567-26-000001
      return {
        // The filing index page names the filer (the bare folder listing doesn't, so it failed the entity check).
        url: `https://www.sec.gov/Archives/edgar/data/${cik}/${adsh.replace(/-/g, "")}/${adsh}-index.htm`,
        title: `Form D filed: ${h._source.display_names[0]}`,
        snippet: `SEC Form D (notice of exempt offering) filed ${h._source.file_date} by ${h._source.display_names.join("; ")}`,
        publishedAt: h._source.file_date,
        source: "sec-form-d",
        sourceTier: "A" as const,
      };
    });
}

export const secFormDSource: SignalSource = {
  name: "sec-form-d",
  enabled: (vc) => secEnabled() && /US/.test(vc.region ?? ""),
  async fetchForVc(vc, since) {
    const firm = vc.firm.replace(/\(.*?\)/g, "").trim();
    const url =
      `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${firm}"`)}&forms=D&dateRange=custom` +
      `&startdt=${since.toISOString().slice(0, 10)}&enddt=${new Date().toISOString().slice(0, 10)}`;
    const res = await fetch(url, { headers: { "User-Agent": process.env.SEC_USER_AGENT! }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`sec ${res.status}`);
    return parseFormD(await res.json(), firm);
  },
};
