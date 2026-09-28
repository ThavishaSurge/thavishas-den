import { structuredPatch, formatPatch } from "diff";
import { readArchive, extOf, type ArchiveFile } from "./archive";
import type {
  Change, DiffLine, DiffOptions, FileResult, Highlight, Hunk, Progress,
  Recommendation, Report, ThemeMeta,
} from "./types";

/* ---------- language helpers ---------- */

const LANG: Record<string, string> = {
  php: "PHP", phtml: "PHP", inc: "PHP", js: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  jsx: "JSX", ts: "TypeScript", tsx: "TSX", vue: "Vue", svelte: "Svelte", css: "CSS",
  scss: "SCSS", sass: "Sass", less: "Less", html: "HTML", htm: "HTML", twig: "Twig",
  liquid: "Liquid", hbs: "Handlebars", json: "JSON", xml: "XML", svg: "SVG", md: "Markdown",
  txt: "Text", pot: "Gettext", po: "Gettext", mo: "Gettext (binary)", yml: "YAML", yaml: "YAML",
  htaccess: "Apache config", png: "Image", jpg: "Image", jpeg: "Image", gif: "Image",
  webp: "Image", avif: "Image", ico: "Image", woff: "Font", woff2: "Font", ttf: "Font",
  otf: "Font", eot: "Font", map: "Source map", sql: "SQL", sh: "Shell",
};

export function languageOf(path: string): string {
  return LANG[extOf(path)] ?? (extOf(path) ? extOf(path).toUpperCase() : "File");
}

const BRACE_LANGS = new Set(["PHP", "JavaScript", "JSX", "TypeScript", "TSX", "CSS", "SCSS", "Less", "Vue", "Svelte"]);
const CSS_LANGS = new Set(["CSS", "SCSS", "Less", "Sass"]);

function isMinified(path: string, text: string): boolean {
  if (/\.min\.(js|css)$/i.test(path)) return true;
  const lines = text.split("\n");
  if (lines.length > 0 && lines.length < 40 && text.length > 5000) return true;
  let long = 0;
  for (const l of lines) if (l.length > 400) long++;
  return lines.length > 0 && long / lines.length > 0.3;
}

/* ---------- scope detection (enclosing function / selector) ---------- */

function cleanHeader(raw: string, lang: string): string | null {
  let h = raw.trim().replace(/\{\s*$/, "").trim();
  if (!h) return null;
  if (CSS_LANGS.has(lang)) return h.length > 90 ? h.slice(0, 87) + "…" : h;
  const fn = h.match(/function\s+&?([A-Za-z_$][\w$]*)\s*\(([^)]*)\)?/);
  if (fn) return `function ${fn[1]}()`;
  const cls = h.match(/\b(class|interface|trait|enum)\s+([A-Za-z_$][\w$]*)/);
  if (cls) return `${cls[1]} ${cls[2]}`;
  const method = h.match(/^(?:(?:public|private|protected|static|async|get|set)\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::\s*[\w?|\\<>\s]+)?$/);
  if (method && !/^(if|for|foreach|while|switch|catch|elseif|else)$/.test(method[1])) return `${method[1]}()`;
  const arrow = h.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\(|[A-Za-z_$][\w$]*\s*=>)/);
  if (arrow) return `${arrow[1]}()`;
  const listener = h.match(/addEventListener\s*\(\s*['"]([\w:-]+)['"]/);
  if (listener) return `'${listener[1]}' listener`;
  if (/\$\(\s*(document|function)|jQuery\(\s*(document|function)/.test(h)) return "document ready";
  const hook = h.match(/(add_action|add_filter|add_shortcode)\s*\(\s*['"]([^'"]+)['"]/);
  if (hook) return `${hook[1]}('${hook[2]}')`;
  if (/^(if|else|elseif|for|foreach|while|switch|try|catch|do)\b|^\}?\s*else/.test(h)) return null;
  return h.length > 70 ? h.slice(0, 67) + "…" : h;
}

/** Walk upward from `index` (0-based) to find the enclosing brace blocks. */
function scopeAt(lines: string[], index: number, lang: string): string[] {
  if (!BRACE_LANGS.has(lang) || index < 0) return [];
  const found: string[] = [];
  let balance = 0;
  const floor = Math.max(0, index - 1500);
  for (let i = Math.min(index, lines.length - 1); i >= floor && found.length < 3; i--) {
    const line = lines[i];
    if (line.length > 600) continue; // skip minified noise
    for (let j = line.length - 1; j >= 0; j--) {
      const ch = line[j];
      if (ch === "}") balance++;
      else if (ch === "{") {
        if (balance === 0) {
          let header = line.slice(0, j + 1);
          if (!header.replace("{", "").trim()) {
            // brace on its own line — use previous non-empty line
            for (let k = i - 1; k >= 0; k--) {
              if (lines[k].trim()) { header = lines[k]; break; }
            }
          }
          const label = cleanHeader(header, lang);
          if (label && !found.includes(label)) found.push(label);
        } else balance--;
      }
    }
  }
  return found.reverse();
}

/* ---------- highlights (WordPress & front-end aware) ---------- */

type Extractor = { re: RegExp; label: (m: RegExpMatchArray) => string };

const PHP_EXTRACTORS: Extractor[] = [
  { re: /function\s+&?([A-Za-z_][\w]*)\s*\(/g, label: (m) => `function ${m[1]}()` },
  { re: /\b(add_action|add_filter|remove_action|remove_filter)\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]?([\w:\\]+)?/g,
    label: (m) => `${m[1]}('${m[2]}'${m[3] ? `, ${m[3]}` : ""})` },
  { re: /\bwp_(enqueue|register)_(style|script)\s*\(\s*['"]([^'"]+)['"]/g, label: (m) => `wp_${m[1]}_${m[2]}('${m[3]}')` },
  { re: /\badd_shortcode\s*\(\s*['"]([^'"]+)['"]/g, label: (m) => `shortcode [${m[1]}]` },
  { re: /\bregister_(post_type|taxonomy|nav_menus?|sidebar|block_type)\s*\(\s*(?:['"]([\w\-/]+)['"])?/g,
    label: (m) => `register_${m[1]}(${m[2] ? `'${m[2]}'` : ""})` },
  { re: /\bget_template_part\s*\(\s*['"]([^'"]+)['"]/g, label: (m) => `get_template_part('${m[1]}')` },
];

const JS_EXTRACTORS: Extractor[] = [
  { re: /function\s+([A-Za-z_$][\w$]*)\s*\(/g, label: (m) => `function ${m[1]}()` },
  { re: /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g,
    label: (m) => `function ${m[1]}()` },
  { re: /addEventListener\s*\(\s*['"]([\w:-]+)['"]/g, label: (m) => `'${m[1]}' event listener` },
];

const CSS_SELECTOR = /^[ \t]*([^{}@;/\s][^{};\n]*?)[ \t]*\{/gm;
const CSS_MEDIA = /^[ \t]*(@media[^{\n]+|@supports[^{\n]+|@keyframes\s+[\w-]+|@font-face)[ \t]*\{/gm;
const CSS_VAR = /(--[\w-]+)\s*:/g;

function extract(lines: string[], extractors: Extractor[]): Set<string> {
  const out = new Set<string>();
  const text = lines.join("\n");
  for (const ex of extractors) for (const m of text.matchAll(ex.re)) out.add(ex.label(m));
  return out;
}

function cssItems(lines: string[]): Set<string> {
  const text = lines.join("\n");
  const out = new Set<string>();
  for (const m of text.matchAll(CSS_SELECTOR)) out.add(`selector ${m[1].replace(/\s+/g, " ").trim()}`);
  for (const m of text.matchAll(CSS_MEDIA)) out.add(m[1].replace(/\s+/g, " ").trim());
  for (const m of text.matchAll(CSS_VAR)) out.add(`variable ${m[1]}`);
  return out;
}

function itemsFor(lang: string, lines: string[]): Set<string> | null {
  if (lang === "PHP") return extract(lines, [...PHP_EXTRACTORS, ...JS_EXTRACTORS.slice(2)]);
  if (["JavaScript", "JSX", "TypeScript", "TSX", "Vue", "Svelte"].includes(lang)) return extract(lines, JS_EXTRACTORS);
  if (CSS_LANGS.has(lang)) return cssItems(lines);
  return null;
}

/** Summarise what a file's edits mean: new / removed / changed functions, hooks, selectors. */
function highlightsFor(lang: string, oldLines: string[], newLines: string[], changes: Change[]): Highlight[] {
  const before = itemsFor(lang, oldLines);
  const after = itemsFor(lang, newLines);
  if (!before || !after) return [];
  const out: Highlight[] = [];
  for (const x of after) if (!before.has(x)) out.push({ tone: "add", text: `Added ${x}` });
  for (const x of before) if (!after.has(x)) out.push({ tone: "remove", text: `Removed ${x}` });

  const changed = new Set<string>();
  // items whose own line was edited (e.g. enqueue arguments changed)
  const remItems = itemsFor(lang, changes.flatMap((c) => c.removed))!;
  const addItems = itemsFor(lang, changes.flatMap((c) => c.added))!;
  for (const x of addItems) if (remItems.has(x) && before.has(x) && after.has(x)) changed.add(`Changed ${x}`);
  // enclosing blocks that were edited
  for (const c of changes) {
    const inner = c.scope[c.scope.length - 1];
    if (!inner) continue;
    const label = CSS_LANGS.has(lang) && !inner.startsWith("@") ? `selector ${inner}` : inner;
    if ((!before.has(label) || after.has(label)) && !changed.has(`Changed ${label}`)) changed.add(`Edited ${label}`);
  }
  for (const x of changed) out.push({ tone: "change", text: x });
  return out.slice(0, 40);
}

function listItems(lang: string, lines: string[], tone: "add" | "remove"): Highlight[] {
  const items = itemsFor(lang, lines);
  if (!items) return [];
  return [...items].slice(0, 12).map((x) => ({ tone, text: `${tone === "add" ? "Adds" : "Removes"} ${x}` }));
}

/* ---------- theme meta ---------- */

function readMeta(files: Map<string, ArchiveFile>): ThemeMeta {
  const style = files.get("style.css");
  if (style?.text) {
    const head = style.text.slice(0, 4000);
    const get = (k: string) => head.match(new RegExp(`^[\\s*]*${k}\\s*:\\s*(.+)$`, "mi"))?.[1]?.trim();
    const name = get("Theme Name");
    if (name) return { name, version: get("Version"), kind: get("Template") ? `Child theme of ${get("Template")}` : "WordPress theme" };
  }
  for (const [p, f] of files) {
    if (/(^|\/)[^/]+\.php$/.test(p) && f.text && /^\s*\*?\s*Plugin Name\s*:/mi.test(f.text.slice(0, 3000))) {
      const head = f.text.slice(0, 3000);
      return {
        name: head.match(/Plugin Name\s*:\s*(.+)/i)?.[1]?.trim(),
        version: head.match(/^\s*\*?\s*Version\s*:\s*(.+)$/mi)?.[1]?.trim(),
        kind: "WordPress plugin",
      };
    }
  }
  const schema = files.get("config/settings_schema.json");
  if (schema?.text) {
    try {
      const info = (JSON.parse(schema.text) as Array<Record<string, string>>).find((s) => s.name === "theme_info");
      if (info) return { name: info.theme_name, version: info.theme_version, kind: "Shopify theme" };
    } catch { /* ignore */ }
    return { kind: "Shopify theme" };
  }
  const pkg = files.get("package.json");
  if (pkg?.text) {
    try {
      const j = JSON.parse(pkg.text) as { name?: string; version?: string };
      return { name: j.name, version: j.version, kind: "Node project" };
    } catch { /* ignore */ }
  }
  return {};
}

/* ---------- per-file diff ---------- */

function toLines(text: string): string[] {
  const lines = text.split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function buildHunks(raw: { oldStart: number; oldLines: number; newStart: number; newLines: number; lines: string[] }[]): Hunk[] {
  return raw.map((h) => {
    let o = h.oldStart, n = h.newStart;
    // jsdiff reports start 0 for empty ranges; normalise so numbering starts at the line after
    if (h.oldLines === 0) o = h.oldStart + 1;
    if (h.newLines === 0) n = h.newStart + 1;
    const lines: DiffLine[] = [];
    for (const l of h.lines) {
      const c = l[0];
      const text = l.slice(1);
      if (c === "\\") continue; // "\ No newline at end of file"
      if (c === " ") lines.push({ type: "context", text, oldNo: o++, newNo: n++ });
      else if (c === "-") lines.push({ type: "remove", text, oldNo: o++, newNo: null });
      else if (c === "+") lines.push({ type: "add", text, oldNo: null, newNo: n++ });
    }
    return { oldStart: h.oldStart, oldLines: h.oldLines, newStart: h.newStart, newLines: h.newLines, lines };
  });
}

function buildChanges(path: string, hunks: Hunk[], oldLines: string[], lang: string): Change[] {
  const changes: Change[] = [];
  let seq = 0;
  for (const hunk of hunks) {
    const L = hunk.lines;
    let i = 0;
    // running cursors so we know positions even before the first changed line
    let lastOld = hunk.oldLines === 0 ? hunk.oldStart : hunk.oldStart - 1;
    let lastNew = hunk.newLines === 0 ? hunk.newStart : hunk.newStart - 1;
    while (i < L.length) {
      if (L[i].type === "context") {
        lastOld = L[i].oldNo!;
        lastNew = L[i].newNo!;
        i++;
        continue;
      }
      const start = i;
      const removed: DiffLine[] = [];
      const added: DiffLine[] = [];
      while (i < L.length && L[i].type !== "context") {
        (L[i].type === "remove" ? removed : added).push(L[i]);
        i++;
      }
      let anchorAbove: string | null = null, anchorAboveNo: number | null = null;
      for (let k = start - 1; k >= 0; k--) {
        if (L[k].type === "context" && L[k].text.trim()) { anchorAbove = L[k].text; anchorAboveNo = L[k].oldNo; break; }
      }
      if (anchorAbove === null) {
        // look further up in the original file
        for (let k = lastOld - 1; k >= 0 && k >= lastOld - 30; k--) {
          if (oldLines[k]?.trim()) { anchorAbove = oldLines[k]; anchorAboveNo = k + 1; break; }
        }
      }
      let anchorBelow: string | null = null;
      for (let k = i; k < L.length; k++) {
        if (L[k].type === "context" && L[k].text.trim()) { anchorBelow = L[k].text; break; }
      }
      const kind = removed.length && added.length ? "replace" : removed.length ? "remove" : "add";
      const oldFrom = removed.length ? removed[0].oldNo! : lastOld;
      const oldTo = removed.length ? removed[removed.length - 1].oldNo! : lastOld;
      const newFrom = added.length ? added[0].newNo! : lastNew;
      const newTo = added.length ? added[added.length - 1].newNo! : lastNew;
      const scopeIndex = removed.length ? oldFrom - 2 : lastOld - 1;
      changes.push({
        id: `${path}#${++seq}`,
        kind,
        oldFrom, oldTo, newFrom, newTo,
        insertAfter: lastOld,
        removed: removed.map((d) => d.text),
        added: added.map((d) => d.text),
        anchorAbove, anchorAboveNo, anchorBelow,
        scope: scopeAt(oldLines, scopeIndex, lang),
      });
      if (removed.length) lastOld = removed[removed.length - 1].oldNo!;
      if (added.length) lastNew = added[added.length - 1].newNo!;
    }
  }
  return changes;
}

function diffTextFile(path: string, before: ArchiveFile, after: ArchiveFile, opts: DiffOptions, fromPath?: string): FileResult {
  const lang = languageOf(path);
  let a = before.text ?? "";
  let b = after.text ?? "";
  if (opts.ignoreLineEndings) {
    a = a.replace(/\r\n?/g, "\n");
    b = b.replace(/\r\n?/g, "\n");
  }
  const oldLines = toLines(a);
  const minified = isMinified(path, b) || isMinified(path, a);
  const base: FileResult = {
    path, fromPath, status: fromPath ? "renamed" : "modified", binary: false, language: lang,
    sizeBefore: before.size, sizeAfter: after.size, linesAdded: 0, linesRemoved: 0, minified,
    churn: 0, recommendation: "apply-edits", changes: [], hunks: [], highlights: [], afterZipPath: after.zipPath, beforeZipPath: before.zipPath,
  };

  if (a === b) {
    return { ...base, cosmeticOnly: "line-endings", recommendation: fromPath ? "move-file" : "none" };
  }

  const tooBig = a.length + b.length > 6_000_000;
  const patch = tooBig
    ? undefined
    : structuredPatch(fromPath ?? path, path, a, b, undefined, undefined, {
        context: opts.context,
        ignoreWhitespace: opts.ignoreWhitespace,
        timeout: 4000,
      });

  if (!patch) {
    return { ...base, tooLarge: true, churn: 1, recommendation: fromPath ? "move-file" : "replace-file",
      highlights: [{ tone: "info", text: "Too large to compare line-by-line — upload the new file as a whole." }] };
  }

  if (patch.hunks.length === 0) {
    return { ...base, cosmeticOnly: "whitespace", recommendation: fromPath ? "move-file" : "none" };
  }

  const hunks = buildHunks(patch.hunks);
  const changes = buildChanges(path, hunks, oldLines, lang);
  let added = 0, removed = 0;
  for (const c of changes) {
    added += c.added.length;
    removed += c.removed.length;
  }
  const churn = Math.min(1, Math.max(added, removed) / Math.max(1, oldLines.length));
  const similarity = (oldLines.length - removed) / Math.max(1, oldLines.length);
  let rec: Recommendation = "apply-edits";
  if (minified || (churn > 0.6 && oldLines.length > 30) || changes.length > 40) rec = "replace-file";
  if (fromPath) rec = rec === "replace-file" ? "move-file" : "move-and-edit";
  const highlights = minified ? [] : highlightsFor(lang, oldLines, toLines(b), changes);
  if (minified) highlights.unshift({ tone: "info", text: "Minified file — replace the whole file instead of editing lines." });

  const patchText = formatPatch({ ...patch, oldFileName: `a/${fromPath ?? path}`, newFileName: `b/${path}` });

  return { ...base, hunks, changes, linesAdded: added, linesRemoved: removed, churn, similarity, recommendation: rec, highlights, patch: patchText };
}

function wholeFileResult(file: ArchiveFile, status: "added" | "removed", includeContent: boolean): FileResult {
  const lang = languageOf(file.path);
  const text = file.text?.replace(/\r\n?/g, "\n");
  const lines = text !== undefined ? toLines(text) : [];
  const minified = text !== undefined ? isMinified(file.path, text) : false;
  const highlights: Highlight[] = [];
  if (text !== undefined && !minified) {
    highlights.push(...listItems(lang, lines, status === "added" ? "add" : "remove"));
  }
  let patch: string | undefined;
  if (text !== undefined && text.length < 2_000_000) {
    const p = status === "added"
      ? structuredPatch("/dev/null", file.path, "", text, undefined, undefined, { context: 0 })
      : structuredPatch(file.path, "/dev/null", text, "", undefined, undefined, { context: 0 });
    patch = formatPatch({
      ...p,
      oldFileName: status === "added" ? "/dev/null" : `a/${file.path}`,
      newFileName: status === "added" ? `b/${file.path}` : "/dev/null",
    });
  }
  return {
    path: file.path, status, binary: file.binary, language: lang,
    sizeBefore: status === "removed" ? file.size : null,
    sizeAfter: status === "added" ? file.size : null,
    linesAdded: status === "added" ? lines.length : 0,
    linesRemoved: status === "removed" ? lines.length : 0,
    minified, churn: 1,
    recommendation: status === "added" ? "upload-new" : "delete-file",
    changes: [], hunks: [], highlights,
    content: includeContent && text !== undefined && text.length < 1_500_000 ? text : undefined,
    patch,
    afterZipPath: status === "added" ? file.zipPath : undefined,
    beforeZipPath: status === "removed" ? file.zipPath : undefined,
  };
}

/* ---------- main entry ---------- */

const yieldToLoop = () => new Promise<void>((r) => setTimeout(r, 0));

export async function analyzeThemes(
  beforeBuf: ArrayBuffer,
  afterBuf: ArrayBuffer,
  names: { before: string; after: string },
  opts: DiffOptions,
  onProgress: (p: Progress) => void,
): Promise<Report> {
  const t0 = Date.now();
  onProgress({ phase: "reading", done: 0, total: 1, label: names.before });
  const before = await readArchive(beforeBuf, opts.exclude, (d, t, p) =>
    onProgress({ phase: "reading", done: d, total: t * 2, label: p }));
  const after = await readArchive(afterBuf, opts.exclude, (d, t, p) =>
    onProgress({ phase: "reading", done: t + d, total: t * 2, label: p }));

  const files: FileResult[] = [];
  const onlyBefore: ArchiveFile[] = [];
  const onlyAfter: ArchiveFile[] = [];
  const both: [ArchiveFile, ArchiveFile][] = [];

  for (const [p, f] of before.files) {
    const g = after.files.get(p);
    if (g) both.push([f, g]);
    else onlyBefore.push(f);
  }
  for (const [p, f] of after.files) if (!before.files.has(p)) onlyAfter.push(f);

  // Renames / moves: identical content, different path.
  const byHash = new Map<string, ArchiveFile[]>();
  for (const f of onlyBefore) byHash.set(f.hash, [...(byHash.get(f.hash) ?? []), f]);
  const renamedBefore = new Set<string>();
  const renamedAfter = new Set<string>();
  for (const g of onlyAfter) {
    const cands = byHash.get(g.hash)?.filter((f) => !renamedBefore.has(f.path));
    if (!cands?.length || g.size === 0) continue;
    const baseName = (s: string) => s.split("/").pop();
    const pick = cands.find((f) => baseName(f.path) === baseName(g.path)) ?? cands[0];
    renamedBefore.add(pick.path);
    renamedAfter.add(g.path);
    files.push({
      path: g.path, fromPath: pick.path, status: "renamed", binary: g.binary, language: languageOf(g.path),
      sizeBefore: pick.size, sizeAfter: g.size, linesAdded: 0, linesRemoved: 0, minified: false, churn: 0,
      recommendation: "move-file", changes: [], hunks: [], highlights: [], afterZipPath: g.zipPath,
      beforeZipPath: pick.zipPath,
    });
  }

  // Same file name moved to a new folder *and* edited (text only, one candidate each side).
  const leftBefore = onlyBefore.filter((f) => !renamedBefore.has(f.path));
  const leftAfter = onlyAfter.filter((f) => !renamedAfter.has(f.path));
  const nameCount = (arr: ArchiveFile[]) => {
    const m = new Map<string, ArchiveFile[]>();
    for (const f of arr) { const n = f.path.split("/").pop()!; m.set(n, [...(m.get(n) ?? []), f]); }
    return m;
  };
  const nb = nameCount(leftBefore), na = nameCount(leftAfter);
  const movedPairs: [ArchiveFile, ArchiveFile][] = [];
  for (const [n, list] of na) {
    const other = nb.get(n);
    if (list.length === 1 && other?.length === 1 && !list[0].binary && !other[0].binary && !/^(index|style|functions)\./.test(n)) {
      movedPairs.push([other[0], list[0]]);
      renamedBefore.add(other[0].path);
      renamedAfter.add(list[0].path);
    }
  }

  const total = both.length + movedPairs.length + onlyBefore.length + onlyAfter.length;
  let done = 0;
  let unchanged = 0;
  const tick = async (label: string) => {
    done++;
    if (done % 20 === 0 || done === total) {
      onProgress({ phase: "comparing", done, total, label });
      await yieldToLoop();
    }
  };

  for (const [f, g] of both) {
    if (f.hash === g.hash) {
      unchanged++;
      if (opts.includeUnchanged) {
        files.push({
          path: g.path, status: "unchanged", binary: g.binary, language: languageOf(g.path),
          sizeBefore: f.size, sizeAfter: g.size, linesAdded: 0, linesRemoved: 0, minified: false,
          churn: 0, recommendation: "none", changes: [], hunks: [], highlights: [],
          afterZipPath: g.zipPath, beforeZipPath: f.zipPath,
        });
      }
    } else if (f.binary || g.binary) {
      files.push({
        path: g.path, status: "modified", binary: true, language: languageOf(g.path),
        sizeBefore: f.size, sizeAfter: g.size, linesAdded: 0, linesRemoved: 0, minified: false,
        churn: 1, recommendation: "replace-file", changes: [], hunks: [],
        highlights: [{ tone: "info", text: `Binary file changed (${f.size.toLocaleString()} → ${g.size.toLocaleString()} bytes).` }],
        afterZipPath: g.zipPath,
        beforeZipPath: f.zipPath,
      });
    } else {
      const r = diffTextFile(g.path, f, g, opts);
      if (r.cosmeticOnly && r.recommendation === "none") {
        unchanged++;
        if (opts.includeUnchanged) files.push({ ...r, status: "unchanged" });
      } else files.push(r);
    }
    await tick(g.path);
  }

  for (const [f, g] of movedPairs) {
    const r = diffTextFile(g.path, f, g, opts, f.path);
    if ((r.similarity ?? 1) < 0.5 || r.tooLarge) {
      // Too different to be the same file — treat as a removal plus an addition.
      renamedBefore.delete(f.path);
      renamedAfter.delete(g.path);
    } else files.push(r);
    await tick(g.path);
  }
  for (const f of onlyBefore) {
    if (!renamedBefore.has(f.path)) files.push(wholeFileResult(f, "removed", true));
    await tick(f.path);
  }
  for (const f of onlyAfter) {
    if (!renamedAfter.has(f.path)) files.push(wholeFileResult(f, "added", true));
    await tick(f.path);
  }

  onProgress({ phase: "finishing", done: total, total });

  files.sort((x, y) => x.path.localeCompare(y.path, undefined, { numeric: true, sensitivity: "base" }));

  const count = (s: FileResult["status"]) => files.filter((f) => f.status === s).length;
  const report: Report = {
    createdAt: new Date().toISOString(),
    beforeName: names.before,
    afterName: names.after,
    beforeRoot: before.root,
    afterRoot: after.root,
    beforeMeta: readMeta(before.files),
    afterMeta: readMeta(after.files),
    options: opts,
    totals: {
      filesBefore: before.files.size,
      filesAfter: after.files.size,
      modified: count("modified"),
      added: count("added"),
      removed: count("removed"),
      renamed: count("renamed"),
      unchanged,
      excluded: before.excluded + after.excluded,
      linesAdded: files.reduce((s, f) => s + f.linesAdded, 0),
      linesRemoved: files.reduce((s, f) => s + f.linesRemoved, 0),
      changes: files.reduce((s, f) => s + f.changes.length, 0),
    },
    files,
    durationMs: Date.now() - t0,
  };
  return report;
}
