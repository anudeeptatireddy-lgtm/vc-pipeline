"use client";
// Copies the opening or nudge line. No database write.
import { Copy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function CopyLineButton({ line, kind, vcId }: { line: string | null; kind: "opening" | "nudge"; vcId: string }) {
  const [toast, setToast] = useState<string | null>(null);
  if (!line) {
    return (
      <Link className="btn" href={`/vc/${vcId}`}>
        See evidence
      </Link>
    );
  }
  const label = kind === "opening" ? "Copy opening line" : "Copy nudge line";
  const done = kind === "opening" ? "Opening line copied" : "Nudge line copied";
  return (
    <>
      <button
        type="button"
        className="btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(line);
            setToast(done);
          } catch {
            setToast("Couldn't copy. Select the line on the detail page");
          }
          setTimeout(() => setToast(null), 2000);
        }}
      >
        <Copy size={14} aria-hidden />
        {label}
      </button>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
