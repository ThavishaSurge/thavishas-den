"use client";

import { useMemo, useState } from "react";
import { Download, FileText, ScrollText } from "lucide-react";
import { ToolFrame } from "../ToolFrame";
import { Empty, FileDrop, Grid, Panel, Stat, TextArea, downloadText } from "../ui";
import { CopyButton } from "../CopyButton";
import { groupEntries, parseLog, SEVERITY, type Group, type LogType } from "@/lib/errorlog";

const TONE: Record<LogType, string> = {
  Fatal: "tone-remove", Parse: "tone-remove", Exception: "tone-remove", Database: "tone-move",
  Warning: "tone-change", Notice: "tone-info", Deprecated: "tone-info", Other: "tone-info",
};

const WHAT: Partial<Record<LogType, string>> = {
  Fatal: "Stops the page from loading — usually a white screen or “There has been a critical error”.",
  Parse: "A syntax error. The file can't run at all until it's fixed.",
  Database: "A query failed — often a missing table after a migration or a plugin not finishing its upgrade.",
  Warning: "The code kept running but something is wrong; can cause broken output.",
  Notice: "Minor issue. Safe to ignore on live sites, but worth fixing in custom code.",
  Deprecated: "Uses something that will stop working in a future PHP or WordPress version.",
};

const rel = (d: Date | null) => {
  if (!d) return "—";
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

export function ErrorLog() {
  const [text, setText] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [types, setTypes] = useState<LogType[]>([]);
  const [src, setSrc] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"count" | "last" | "severity">("severity");

  const { entries, groups } = useMemo(() => {
    const e = parseLog(text);
    return { entries: e, groups: groupEntries(e) };
  }, [text]);

  const typeCounts = useMemo(() => {
    const m = new Map<LogType, number>();
    for (const g of groups) m.set(g.type, (m.get(g.type) ?? 0) + g.count);
    return SEVERITY.filter((t) => m.has(t)).map((t) => [t, m.get(t)!] as const);
  }, [groups]);

  const sources = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of groups) m.set(g.source, (m.get(g.source) ?? 0) + g.count);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [groups]);

  const days = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) if (e.time) { const k = e.time.toISOString().slice(0, 10); m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-30);
  }, [entries]);

  const shown = useMemo(() => {
    const needle = q.toLowerCase();
    return groups
      .filter((g) => (!types.length || types.includes(g.type)) && (!src || g.source === src) && (!needle || `${g.message} ${g.file}`.toLowerCase().includes(needle)))
      .sort((a, b) => sort === "count" ? b.count - a.count : sort === "last" ? (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0) : SEVERITY.indexOf(a.type) - SEVERITY.indexOf(b.type) || b.count - a.count);
  }, [groups, types, src, q, sort]);

  const summary = [
    `Error log summary${name ? ` (${name})` : ""}: ${entries.length} entries, ${groups.length} distinct issues.`,
    ...shown.slice(0, 15).map((g) => `- ${g.count}× ${g.type}: ${g.message.slice(0, 140)}${g.file ? ` (${g.file.replace(/^.*wp-content\//, "wp-content/")}:${g.line})` : ""} [${g.source}]`),
  ].join("\n");

  const csv = () => {
    const head = ["count", "type", "source", "message", "file", "line", "first_seen", "last_seen"];
    const rows = shown.map((g) => [g.count, g.type, g.source, g.message, g.file ?? "", g.line ?? "", g.first?.toISOString() ?? "", g.last?.toISOString() ?? ""].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
    downloadText("error-log-grouped.csv", [head.join(","), ...rows].join("\n"), "text/csv");
  };

  if (!text) {
    return (
      <ToolFrame slug="error-log">
        <Grid>
          <FileDrop accept=".log,.txt,text/plain" label="Drop debug.log or error_log" hint="WordPress debug.log, cPanel error_log, PHP-FPM or Nginx logs. Big files are fine." icon={<ScrollText size={26} />}
            onFiles={async ([f]) => { setName(f.name); setText(await f.text()); }} />
          <Panel title="…or paste log lines">
            <TextArea code rows={8} placeholder="[26-Sep-2026 08:14:02 UTC] PHP Warning:  Undefined array key …" onChange={(e) => { setName(null); setText(e.target.value); }} />
            <p className="help">Turn logging on with <code>WP_DEBUG</code> and <code>WP_DEBUG_LOG</code> (the Config File Generator can write that for you). The log is at <code>wp-content/debug.log</code>.</p>
          </Panel>
        </Grid>
      </ToolFrame>
    );
  }

  return (
    <ToolFrame slug="error-log" wide>
      <div className="stack">
        <Panel
          title={name ?? "Pasted log"}
          actions={
            <>
              <CopyButton text={summary} label="Copy summary" />
              <button className="btn btn--ghost btn--sm" onClick={csv}><Download size={14} /> CSV</button>
              <button className="btn btn--sm" onClick={() => { setText(""); setName(null); setTypes([]); setSrc(null); }}><FileText size={14} /> Another log</button>
            </>
          }
        >
          <div className="kvs">
            <Stat label="log entries" value={entries.length.toLocaleString()} />
            <Stat label="distinct issues" value={groups.length} />
            <Stat label="fatal errors" value={typeCounts.find(([t]) => t === "Fatal")?.[1] ?? 0} tone={typeCounts.some(([t]) => t === "Fatal") ? "rem" : "add"} />
            <Stat label="last entry" value={rel(entries.reduce<Date | null>((m, e) => (e.time && (!m || e.time > m) ? e.time : m), null))} />
          </div>
          {days.length > 1 && (
            <div className="el-days" aria-label="Entries per day">
              {days.map(([d, n]) => {
                const max = Math.max(...days.map((x) => x[1]));
                return <span key={d} title={`${d}: ${n}`} style={{ height: `${Math.max(6, (n / max) * 100)}%` }} />;
              })}
            </div>
          )}
        </Panel>

        <div className="el-layout">
          <aside className="stack">
            <Panel title="Type">
              <div className="filters">
                {typeCounts.map(([t, n]) => (
                  <button key={t} className={`filter${types.includes(t) ? " filter--on" : ""}`} onClick={() => setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t])}>{t} <span>{n}</span></button>
                ))}
              </div>
            </Panel>
            <Panel title="Where it comes from">
              <ul className="el-sources">
                {sources.map(([s, n]) => (
                  <li key={s}>
                    <button className={src === s ? "on" : ""} onClick={() => setSrc(src === s ? null : s)}>
                      <span>{s}</span><span className="muted">{n}</span>
                      <i style={{ width: `${(n / sources[0][1]) * 100}%` }} />
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          </aside>

          <Panel
            title={`${shown.length} issue${shown.length === 1 ? "" : "s"}`}
            actions={
              <>
                <label className="search" style={{ width: 220 }}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages" aria-label="Search messages" /></label>
                <select className="inp" style={{ width: 150, height: 36 }} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
                  <option value="severity">Worst first</option>
                  <option value="count">Most frequent</option>
                  <option value="last">Most recent</option>
                </select>
              </>
            }
          >
            {shown.length === 0 ? (
              <Empty title={groups.length ? "Nothing matches the filters" : "No PHP errors found"}>{groups.length ? "Clear a filter on the left." : "Is this a PHP / WordPress log?"}</Empty>
            ) : (
              shown.slice(0, 300).map((g: Group) => (
                <details key={g.key} className="finding">
                  <summary>
                    <span className="el-count">{g.count}×</span>
                    <span className={`chip ${TONE[g.type]}`}>{g.type}</span>
                    <span className="el-msg">{g.message}</span>
                  </summary>
                  <div className="el-body">
                    {WHAT[g.type] && <p className="finding__why">{WHAT[g.type]}</p>}
                    <dl className="dl">
                      <div><dt>Source</dt><dd>{g.source}</dd></div>
                      {g.file && <div><dt>File</dt><dd><code>{g.file.replace(/^.*?(wp-content|wp-includes|wp-admin)\//, "$1/")}</code>{g.line ? `, line ${g.line}` : ""}</dd></div>}
                      <div><dt>First / last seen</dt><dd>{g.first?.toLocaleString() ?? "—"} to {g.last?.toLocaleString() ?? "—"}</dd></div>
                    </dl>
                    {g.trace.length > 0 && <pre className="out__pre" style={{ maxHeight: 220 }}>{g.trace.join("\n")}</pre>}
                  </div>
                </details>
              ))
            )}
          </Panel>
        </div>
      </div>
    </ToolFrame>
  );
}
