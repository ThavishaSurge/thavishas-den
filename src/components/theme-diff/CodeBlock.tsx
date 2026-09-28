"use client";

import { useState } from "react";
import type { Segment } from "@/lib/theme-diff/wordDiff";

export type CodeTone = "add" | "remove" | "context";

export interface CodeRow {
  no?: number | null;
  no2?: number | null;
  text: string;
  tone: CodeTone;
  segments?: Segment[] | null;
}

const SIGN: Record<CodeTone, string> = { add: "+", remove: "−", context: " " };

/** A block of code with line numbers and optional word-level highlights. */
export function CodeBlock({ rows, twoNumbers = false, maxRows = 600 }: { rows: CodeRow[]; twoNumbers?: boolean; maxRows?: number }) {
  const [all, setAll] = useState(false);
  const shown = !all && rows.length > maxRows ? rows.slice(0, maxRows) : rows;
  return (
    <div className="code" role="table">
      {shown.map((r, i) => (
        <div key={i} className={`code__row code__row--${r.tone}`} role="row">
          <span className="code__no" role="cell">{r.no ?? ""}</span>
          {twoNumbers && <span className="code__no" role="cell">{r.no2 ?? ""}</span>}
          <span className="code__sign" role="cell" aria-hidden="true">{SIGN[r.tone]}</span>
          <span className="code__text" role="cell">
            {r.segments
              ? r.segments.map((s, j) => (s.hit ? <mark key={j}>{s.text}</mark> : <span key={j}>{s.text}</span>))
              : r.text || " "}
          </span>
        </div>
      ))}
      {!all && rows.length > maxRows && (
        <button type="button" className="code__more" onClick={() => setAll(true)}>
          Show {(rows.length - maxRows).toLocaleString()} more lines
        </button>
      )}
    </div>
  );
}
