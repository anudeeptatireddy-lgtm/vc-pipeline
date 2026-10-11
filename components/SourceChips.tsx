import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { sourceLabel } from "@/lib/format";

export function SourceChips({ sources, vcId }: { sources: { name: string; url: string }[]; vcId: string }) {
  const shown = sources.slice(0, 3);
  const extra = sources.length - shown.length;
  return (
    <>
      {shown.map((s) => (
        <a key={s.url} className="chip chip-src" href={s.url} target="_blank" rel="noopener noreferrer">
          {sourceLabel(s.name, s.url)}
          <ExternalLink size={12} aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ))}
      {extra > 0 && (
        <Link className="chip chip-src" href={`/vc/${vcId}`}>
          +{extra} more
        </Link>
      )}
    </>
  );
}
