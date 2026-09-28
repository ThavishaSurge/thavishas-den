"use client";

import type { Hunk, DiffLine } from "@/lib/theme-diff/types";
import { pairRuns, type Segment } from "@/lib/theme-diff/wordDiff";
import { CodeBlock, type CodeRow } from "./CodeBlock";

/** Collect word-level segments for each changed line in a hunk. */
function segmentsFor(lines: DiffLine[]): Map<number, Segment[]> {
  const out = new Map<number, Segment[]>();
  let i = 0;
  while (i < lines.length) {
    if (lines[i].type === "context") { i++; continue; }
    const rem: number[] = [], add: number[] = [];
    while (i < lines.length && lines[i].type !== "context") {
      (lines[i].type === "remove" ? rem : add).push(i);
      i++;
    }
    const pairs = pairRuns(rem.map((k) => lines[k].text), add.map((k) => lines[k].text));
    pairs.forEach((p, k) => {
      if (!p) return;
      out.set(rem[k], p.a);
      out.set(add[k], p.b);
    });
  }
  return out;
}

export function UnifiedView({ hunks }: { hunks: Hunk[] }) {
  return (
    <div className="hunks">
      {hunks.map((h, hi) => {
        const seg = segmentsFor(h.lines);
        const rows: CodeRow[] = h.lines.map((l, i) => ({
          no: l.oldNo, no2: l.newNo, text: l.text, tone: l.type, segments: seg.get(i),
        }));
        return (
          <section key={hi} className="hunk">
            <div className="hunk__head mono">
              @@ −{h.oldStart},{h.oldLines} +{h.newStart},{h.newLines} @@
            </div>
            <CodeBlock rows={rows} twoNumbers />
          </section>
        );
      })}
    </div>
  );
}

type SplitCell = { no: number | null; text: string; tone: "add" | "remove" | "context" | "empty"; segments?: Segment[] };

export function SplitView({ hunks }: { hunks: Hunk[] }) {
  return (
    <div className="hunks">
      {hunks.map((h, hi) => {
        const seg = segmentsFor(h.lines);
        const rows: [SplitCell, SplitCell][] = [];
        let i = 0;
        const L = h.lines;
        while (i < L.length) {
          if (L[i].type === "context") {
            rows.push([
              { no: L[i].oldNo, text: L[i].text, tone: "context" },
              { no: L[i].newNo, text: L[i].text, tone: "context" },
            ]);
            i++;
            continue;
          }
          const rem: number[] = [], add: number[] = [];
          while (i < L.length && L[i].type !== "context") {
            (L[i].type === "remove" ? rem : add).push(i);
            i++;
          }
          const n = Math.max(rem.length, add.length);
          for (let k = 0; k < n; k++) {
            const r = rem[k], a = add[k];
            rows.push([
              r !== undefined ? { no: L[r].oldNo, text: L[r].text, tone: "remove", segments: seg.get(r) } : { no: null, text: "", tone: "empty" },
              a !== undefined ? { no: L[a].newNo, text: L[a].text, tone: "add", segments: seg.get(a) } : { no: null, text: "", tone: "empty" },
            ]);
          }
        }
        return (
          <section key={hi} className="hunk">
            <div className="hunk__head mono">
              @@ −{h.oldStart},{h.oldLines} +{h.newStart},{h.newLines} @@
            </div>
            <div className="split" role="table">
              {rows.map(([l, r], k) => (
                <div className="split__row" role="row" key={k}>
                  {[l, r].map((c, side) => (
                    <div key={side} className={`split__cell split__cell--${c.tone}`} role="cell">
                      <span className="code__no">{c.no ?? ""}</span>
                      <span className="code__text">
                        {c.segments
                          ? c.segments.map((s, j) => (s.hit ? <mark key={j}>{s.text}</mark> : <span key={j}>{s.text}</span>))
                          : c.text || " "}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
