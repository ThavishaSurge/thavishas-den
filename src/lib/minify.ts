/* Lightweight minifiers that respect strings and comments. */

export function minifyCss(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    // comments (keep /*! licence */ comments)
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      if (src[i + 2] === "!") out += src.slice(i, stop);
      i = stop;
      continue;
    }
    // strings
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === "\\") j++;
        j++;
      }
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    // url(...) without quotes — copy verbatim
    if ((c === "u" || c === "U") && /^url\(/i.test(src.slice(i, i + 4))) {
      const end = src.indexOf(")", i);
      const stop = end === -1 ? n : end + 1;
      out += src.slice(i, stop).replace(/^url\(\s+/i, "url(").replace(/\s+\)$/, ")");
      i = stop;
      continue;
    }
    if (/\s/.test(c)) {
      while (i < n && /\s/.test(src[i])) i++;
      const prev = out[out.length - 1];
      const next = src[i];
      if (prev === undefined || next === undefined) continue;
      if ("{};,>~(".includes(prev) || "{};,>~)!".includes(next) || prev === ":") continue;
      if (next === ":") {
        // drop the space in "color : red" but keep it in selectors like ".a :hover"
        const rest = src.slice(i);
        const stop = rest.search(/[;{}]/);
        if (stop !== -1 && rest[stop] !== "{") continue;
      }
      out += " ";
      continue;
    }
    out += c;
    i++;
  }
  return out.replace(/;}/g, "}").trim();
}

const RAW_TAGS = ["pre", "textarea", "script", "style"];

export function minifyHtml(src: string, opts: { aggressive: boolean; minifyInlineCss: boolean }): string {
  const parts: string[] = [];
  let i = 0;
  const lower = src.toLowerCase();
  while (i < src.length) {
    // find next raw block
    let nextRaw = -1;
    let rawTag = "";
    for (const t of RAW_TAGS) {
      const k = lower.indexOf(`<${t}`, i);
      if (k !== -1 && (nextRaw === -1 || k < nextRaw) && /[\s>]/.test(lower[k + t.length + 1] ?? "")) {
        nextRaw = k;
        rawTag = t;
      }
    }
    const chunkEnd = nextRaw === -1 ? src.length : nextRaw;
    parts.push(collapse(src.slice(i, chunkEnd), opts.aggressive));
    if (nextRaw === -1) break;
    const close = lower.indexOf(`</${rawTag}`, nextRaw);
    const closeEnd = close === -1 ? src.length : lower.indexOf(">", close) + 1 || src.length;
    let block = src.slice(nextRaw, closeEnd);
    if (rawTag === "style" && opts.minifyInlineCss) {
      const open = block.indexOf(">") + 1;
      const inner = block.slice(open, block.toLowerCase().lastIndexOf("</style"));
      block = block.slice(0, open) + minifyCss(inner) + block.slice(block.toLowerCase().lastIndexOf("</style"));
    }
    parts.push(block);
    i = closeEnd;
  }
  return parts.join("").trim();
}

function collapse(html: string, aggressive: boolean): string {
  let s = html.replace(/<!--(?!\[if|<!|\s*\/?noindex)[\s\S]*?-->/g, "");
  s = s.replace(/\s+/g, " ");
  if (aggressive) s = s.replace(/>\s+</g, "><");
  else s = s.replace(/>\s+</g, "> <");
  return s;
}

/** Roughly `php -w`: strips comments and collapses whitespace inside PHP blocks. */
export function minifyPhp(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  let inPhp = false;
  const word = /[A-Za-z0-9_$\\\x80-￿]/;

  /** Emit a single space only where two word characters would otherwise merge. */
  const gap = () => {
    while (i < n && /\s/.test(src[i])) i++;
    const prev = out[out.length - 1] ?? "";
    const next = src[i] ?? "";
    if (word.test(prev) && word.test(next)) out += " ";
    else if ((prev === "+" && next === "+") || (prev === "-" && next === "-")) out += " ";
  };

  while (i < n) {
    if (!inPhp) {
      const open = src.indexOf("<?", i);
      if (open === -1) {
        out += src.slice(i);
        break;
      }
      out += src.slice(i, open);
      if (src.startsWith("<?php", open)) {
        out += "<?php ";
        i = open + 5;
      } else if (src.startsWith("<?=", open)) {
        out += "<?=";
        i = open + 3;
      } else {
        out += "<?";
        i = open + 2;
      }
      inPhp = true;
      continue;
    }
    const c = src[i];
    // close tag
    if (c === "?" && src[i + 1] === ">") {
      out = out.replace(/\s+$/, "");
      out += "?>";
      i += 2;
      if (src[i] === "\n") { out += "\n"; i++; }
      inPhp = false;
      continue;
    }
    // comments (# but not #[ attribute)
    if ((c === "/" && src[i + 1] === "/") || (c === "#" && src[i + 1] !== "[")) {
      while (i < n && src[i] !== "\n" && !(src[i] === "?" && src[i + 1] === ">")) i++;
      gap();
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      gap();
      continue;
    }
    // heredoc / nowdoc
    if (c === "<" && src.startsWith("<<<", i)) {
      const m = src.slice(i).match(/^<<<[ \t]*(["']?)([A-Za-z_][A-Za-z0-9_]*)\1\r?\n/);
      if (m) {
        const label = m[2];
        const re = new RegExp(`\\n[ \\t]*${label}\\b`, "g");
        re.lastIndex = i + m[0].length - 1;
        const end = re.exec(src);
        const stop = end ? end.index + end[0].length : n;
        out += src.slice(i, stop);
        i = stop;
        continue;
      }
    }
    // strings
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === "\\") j++;
        j++;
      }
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (/\s/.test(c)) {
      gap();
      continue;
    }
    out += c;
    i++;
  }
  return out.trim();
}

export type Lang = "html" | "css" | "js" | "php" | "json";

export function detectLang(code: string): Lang | null {
  const s = code.trimStart();
  if (!s) return null;
  if (s.startsWith("<?php") || /<\?php/.test(s.slice(0, 2000))) return "php";
  if (/^[{[]/.test(s)) {
    try {
      JSON.parse(s);
      return "json";
    } catch { /* not json */ }
  }
  if (/^<(!doctype|html|div|section|head|body|span|p|a|ul|main|header|footer|nav|template|svg|table|form|img|link|meta|script|style)\b/i.test(s)) return "html";
  if (/^(@media|@import|@font-face|:root|[.#*]?[\w-]+(\s*[,>+~]\s*[.#]?[\w-]+)*\s*\{)/m.test(s) && !/\b(function|const|let|var|=>)\b/.test(s.slice(0, 400))) return "css";
  if (/\b(function|const|let|var|=>|document\.|window\.|import |export )/.test(s)) return "js";
  return null;
}
