import { readFileSync } from "fs";
import { analyzeThemes } from "../src/lib/theme-diff/analyze";
import { DEFAULT_OPTIONS } from "../src/lib/theme-diff/types";
import { toMarkdown } from "../src/lib/theme-diff/export";
const buf = (p: string) => { const b = readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
analyzeThemes(buf(process.argv[2]), buf(process.argv[3]), { before: "before.zip", after: "after.zip" }, DEFAULT_OPTIONS, () => {})
  .then((r) => {
    console.log(JSON.stringify(r.totals), r.beforeRoot, r.afterRoot, r.beforeMeta, r.afterMeta, r.durationMs + "ms");
    for (const f of r.files) console.log(f.status.padEnd(9), f.recommendation.padEnd(13), f.path, f.fromPath ?? "", f.highlights.map(h => h.text).join(" | "));
    if (process.argv[4]) console.log(toMarkdown(r));
  });
