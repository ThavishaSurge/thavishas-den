import { diffWordsWithSpace } from "diff";

export interface Segment {
  text: string;
  hit: boolean;
}

/** Word-level highlight for a pair of changed lines. Returns null if the lines are too different to be useful. */
export function wordDiff(a: string, b: string): { a: Segment[]; b: Segment[] } | null {
  if (a.length > 2000 || b.length > 2000) return null;
  const parts = diffWordsWithSpace(a, b);
  const A: Segment[] = [];
  const B: Segment[] = [];
  let same = 0;
  for (const p of parts) {
    if (p.added) B.push({ text: p.value, hit: true });
    else if (p.removed) A.push({ text: p.value, hit: true });
    else {
      same += p.value.trim().length;
      A.push({ text: p.value, hit: false });
      B.push({ text: p.value, hit: false });
    }
  }
  const longest = Math.max(a.trim().length, b.trim().length, 1);
  if (same / longest < 0.3) return null;
  return { a: A, b: B };
}

/** Pairs lines of a remove/add run one-to-one when the counts line up. */
export function pairRuns(removed: string[], added: string[]): (null | { a: Segment[]; b: Segment[] })[] {
  const n = Math.min(removed.length, added.length);
  if (!n || Math.abs(removed.length - added.length) > Math.max(2, n)) return [];
  const out: (null | { a: Segment[]; b: Segment[] })[] = [];
  for (let i = 0; i < n; i++) out.push(wordDiff(removed[i], added[i]));
  return out;
}
