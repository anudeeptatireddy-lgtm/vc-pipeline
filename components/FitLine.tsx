// "Fits: B2B, logistics, software, seed" or "Partial fit: {gap}" (§4, §8).
export function fitText(f: { sector: string; customer: string; offering: string; stage: string }, relevance: string): string | null {
  if (relevance === "direct" || relevance === "thematic") {
    const pass = [
      f.customer === "b2b" && "B2B",
      f.sector === "fit" && "logistics",
      f.offering === "software" && "software",
      ["pre-seed", "seed", "seed-extension"].includes(f.stage) && "seed",
    ].filter(Boolean);
    return pass.length ? `Fits: ${pass.join(", ")}` : null;
  }
  if (relevance === "adjacent") {
    const gap =
      f.customer === "b2c"
        ? "consumer logistics"
        : f.offering === "hardware"
          ? "hardware, not software"
          : f.offering === "asset_heavy"
            ? "asset-heavy, not software"
            : f.sector === "partial"
              ? "general B2B, not logistics"
              : "not a software deal";
    return `Partial fit: ${gap}`;
  }
  return "Partial fit: not logistics";
}

export function FitLine(props: { fit: { sector: string; customer: string; offering: string; stage: string }; relevance: string }) {
  const t = fitText(props.fit, props.relevance);
  return t ? <p className="fit">{t}</p> : null;
}
