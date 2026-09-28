/* Runs regex matching in a throwaway worker so a runaway pattern can't freeze the tab. */

export interface RxMatch {
  index: number;
  end: number;
  text: string;
  groups: (string | undefined)[];
  named: Record<string, string | undefined> | null;
}

export interface RxResult {
  matches: RxMatch[];
  replaced: string | null;
  truncated: boolean;
  ms: number;
}

const WORKER_SRC = `
self.onmessage = (e) => {
  const { source, flags, text, replacement, limit } = e.data;
  const t0 = performance.now();
  try {
    const re = new RegExp(source, flags.includes("g") ? flags : flags + "g");
    const matches = [];
    let m, truncated = false;
    while ((m = re.exec(text)) !== null) {
      matches.push({ index: m.index, end: m.index + m[0].length, text: m[0], groups: m.slice(1), named: m.groups ? { ...m.groups } : null });
      if (m[0].length === 0) re.lastIndex++;
      if (!flags.includes("g")) break;
      if (matches.length >= limit) { truncated = true; break; }
    }
    let replaced = null;
    if (replacement !== null) replaced = text.replace(new RegExp(source, flags), replacement);
    self.postMessage({ ok: true, result: { matches, replaced, truncated, ms: performance.now() - t0 } });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err) });
  }
};`;

let url: string | null = null;

export function runRegex(source: string, flags: string, text: string, replacement: string | null, timeoutMs = 1500): Promise<RxResult> {
  if (!url) url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
  return new Promise((resolve, reject) => {
    const w = new Worker(url!);
    const timer = setTimeout(() => {
      w.terminate();
      reject(new Error(`Stopped after ${timeoutMs / 1000}s — this pattern backtracks too much on this text (catastrophic backtracking). Make nested quantifiers like (a+)+ more specific.`));
    }, timeoutMs);
    w.onmessage = (e) => {
      clearTimeout(timer);
      w.terminate();
      if (e.data.ok) resolve(e.data.result);
      else reject(new Error(e.data.error));
    };
    w.postMessage({ source, flags, text, replacement, limit: 5000 });
  });
}

/** PHP preg_* version of a JS pattern. */
export function toPhp(source: string, flags: string): string {
  const delim = "/";
  const body = source.replace(/(?<!\\)\//g, "\\/");
  const phpFlags = flags.replace(/[gyd]/g, "").replace("v", "u");
  return `'${delim}${body.replace(/'/g, "\\'")}${delim}${phpFlags}'`;
}
