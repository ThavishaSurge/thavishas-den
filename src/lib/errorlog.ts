/* Parses PHP / WordPress error logs into grouped issues. */

export type LogType = "Fatal" | "Parse" | "Warning" | "Notice" | "Deprecated" | "Database" | "Exception" | "Other";

export interface Entry {
  time: Date | null;
  type: LogType;
  message: string;
  file: string | null;
  line: number | null;
  trace: string[];
}

export interface Group {
  key: string;
  type: LogType;
  message: string;
  file: string | null;
  line: number | null;
  source: string;
  count: number;
  first: Date | null;
  last: Date | null;
  trace: string[];
  samples: string[];
}

const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

function parseTime(s: string): Date | null {
  // 26-Sep-2026 08:14:02 UTC
  let m = s.match(/(\d{2})-(\w{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2})(?:\s+(UTC|[A-Za-z_/+-]+))?/);
  if (m && MONTHS[m[2]] !== undefined) {
    const d = Date.UTC(+m[3], MONTHS[m[2]], +m[1], +m[4], +m[5], +m[6]);
    return new Date(d);
  }
  // 2026/09/26 08:14:02 or 2026-09-26 08:14:02
  m = s.match(/(\d{4})[/-](\d{2})[/-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  return null;
}

function typeOf(label: string): LogType {
  const l = label.toLowerCase();
  if (l.includes("fatal")) return "Fatal";
  if (l.includes("parse")) return "Parse";
  if (l.includes("warning")) return "Warning";
  if (l.includes("notice")) return "Notice";
  if (l.includes("deprecated")) return "Deprecated";
  if (l.includes("exception")) return "Exception";
  return "Other";
}

const HEAD = /^\[([^\]]+)\]\s*(.*)$/;
const PHP_MSG = /PHP (Fatal error|Parse error|Warning|Notice|Deprecated|Recoverable fatal error|Catchable fatal error|Strict Standards|Core Warning|User Warning|User Notice|User Deprecated)\s*:\s*(.*)$/i;
const LOCATION = /\s+in\s+(\/[^\s:]+|[A-Z]:\\[^\s:]+|[\w./-]+\.php)(?:\s+on\s+line\s+|:)(\d+)/;
const TRACE_LINE = /^(#\d+ |PHP\s+\d+\.|Stack trace:|PHP Stack trace:|\s+thrown in|\s+at\s|  )/;

export function parseLog(text: string): Entry[] {
  const entries: Entry[] = [];
  let cur: Entry | null = null;
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    if (!raw.trim()) continue;
    let line = raw;
    let time: Date | null = null;
    const h = line.match(HEAD);
    if (h && /\d{4}/.test(h[1])) {
      time = parseTime(h[1]);
      line = h[2];
    } else {
      const ng = line.match(/^(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) \[\w+\] .*?(PHP message: .*)$/);
      if (ng) {
        time = parseTime(ng[1]);
        line = ng[2].replace(/^PHP message:\s*/, "").replace(/"\s*(while reading|,\s*client:).*$/, "");
      }
    }
    const continuation = !time && cur && (TRACE_LINE.test(raw) || /^PHP\s+\d+\./.test(line) || /^#\d+/.test(line.trim()));
    if (continuation) {
      if (cur!.trace.length < 40) cur!.trace.push(raw.trim());
      if (!cur!.file) {
        const t = raw.match(/thrown in (\S+) on line (\d+)/);
        if (t) { cur!.file = t[1]; cur!.line = +t[2]; }
      }
      continue;
    }
    if (/^PHP Stack trace:/.test(line) && cur) continue;

    let type: LogType = "Other";
    let message = line.trim();
    const pm = line.match(PHP_MSG);
    if (pm) {
      type = typeOf(pm[1]);
      message = pm[2].trim();
    } else if (/^WordPress database error/i.test(line)) {
      type = "Database";
      message = line.replace(/^WordPress database error\s*/i, "");
    } else if (/Uncaught|Exception/i.test(line)) {
      type = /Uncaught/.test(line) ? "Fatal" : "Exception";
    }
    let file: string | null = null, ln: number | null = null;
    const loc = message.match(LOCATION);
    if (loc) {
      file = loc[1];
      ln = +loc[2];
      if (type !== "Database") message = message.slice(0, loc.index).trim();
    }
    if (type === "Fatal" && /Uncaught/.test(message)) {
      // keep only the first line of the exception message
      message = message.replace(/\s+Stack trace:.*$/, "");
    }
    const td = message.match(/<code>([\w-]+)<\/code> domain/);
    message = message.replace(/<\/?(strong|code|em|b|i)>/g, "");
    if (td) message = message.replace(`for the ${td[1]} domain`, `for the "${td[1]}" domain`);
    cur = { time, type, message, file, line: ln, trace: [] };
    entries.push(cur);
  }
  return entries;
}

export function sourceOf(file: string | null, message: string): string {
  const s = file ?? message;
  let m = s.match(/wp-content\/plugins\/([^/]+)/);
  if (m) return `plugin: ${m[1]}`;
  m = s.match(/wp-content\/mu-plugins\/([^/]+)/);
  if (m) return `mu-plugin: ${m[1].replace(/\.php$/, "")}`;
  m = s.match(/wp-content\/themes\/([^/]+)/);
  if (m) return `theme: ${m[1]}`;
  const td = message.match(/for the "([\w-]+)" domain/);
  if (td) return `text domain: ${td[1]}`;
  if (/wp-(includes|admin)\//.test(s)) return "WordPress core";
  m = message.match(/made by .*?(?:wp-content\/plugins\/([^/]+)|plugins\/([\w-]+))/);
  if (m) return `plugin: ${m[1] ?? m[2]}`;
  return "other";
}

function normalise(msg: string): string {
  return msg
    .replace(/'[^']*'|"[^"]*"/g, "'…'")
    .replace(/\b0x[0-9a-f]+\b/gi, "0x…")
    .replace(/\b\d+(\.\d+)?\b/g, "N")
    .replace(/\s+/g, " ")
    .slice(0, 300);
}

export function groupEntries(entries: Entry[]): Group[] {
  const map = new Map<string, Group>();
  for (const e of entries) {
    const key = `${e.type}|${normalise(e.message)}|${e.file ?? ""}|${e.line ?? ""}`;
    let g = map.get(key);
    if (!g) {
      g = { key, type: e.type, message: e.message, file: e.file, line: e.line, source: sourceOf(e.file, e.message), count: 0, first: e.time, last: e.time, trace: e.trace, samples: [] };
      map.set(key, g);
    }
    g.count++;
    if (e.time) {
      if (!g.first || e.time < g.first) g.first = e.time;
      if (!g.last || e.time > g.last) g.last = e.time;
    }
    if (g.samples.length < 3 && !g.samples.includes(e.message)) g.samples.push(e.message);
    if (!g.trace.length && e.trace.length) g.trace = e.trace;
  }
  return [...map.values()];
}

export const SEVERITY: LogType[] = ["Fatal", "Parse", "Exception", "Database", "Warning", "Notice", "Deprecated", "Other"];
